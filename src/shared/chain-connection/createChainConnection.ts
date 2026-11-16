import { getSyncProvider } from '@polkadot-api/json-rpc-provider-proxy';
import { type JsonRpcProvider, type PolkadotClient, createClient } from 'polkadot-api';

import { createBrokerWarner } from './createBrokerWarner';
import { type ChainLanes, createChainLanes } from './createChainLanes';
import { createConnectionManager } from './createConnectionManager';
import { createRefCounter } from './createRefCounter';
import { type RestartableJsonRpcProvider, createRestartableProvider } from './createRestartableProvider';
import { noop } from './noop';
import { runEvery } from './runEvery';
import { type ChainConfig, type ConnectionStatus } from './types';

export type ChainConnectionConfig<C extends ChainConfig, T = PolkadotClient> = {
  // A provider that cannot recover by itself calls `onHalt` once its connection is gone for good, and the pool rebuilds
  // it. A provider that recovers by itself ignores it.
  createProvider(
    chain: C,
    onStatusChanged: (status: ConnectionStatus) => void,
    onHalt: (error?: unknown) => void,
  ): JsonRpcProvider;
  clientOptions?(chain: C): Parameters<typeof createClient>[1];
  // Defaults to polkadot-api's `createClient`. An injection point for tests and for wrapping client construction — polkadot-api is imported either way.
  createClient?: typeof createClient;
  resolve(chain: C, client: PolkadotClient): Promise<T>;
  // The most `chainHead_v1_follow` subscriptions one transport of the chain may hold. Read at every lane pick,
  // so a value that changes with the chain's transport applies to the next pick.
  followLimit(chain: C): number;
  destroyDelay?: number;
};

type PoolEntry = {
  client: PolkadotClient;
  lanes: ChainLanes;
};

type ChainConnection<C extends ChainConfig, T = PolkadotClient> = {
  lockApi(chain: C): Promise<{ api: T; unlock: VoidFunction }>;
  getProvider(chain: C): JsonRpcProvider;
  status(genesisHash: string): ConnectionStatus;
  onStatusChanged(genesisHash: string, callback: (status: ConnectionStatus) => void): VoidFunction;
  // Drop the inner socket of every active provider that supports pausing
  // (e.g. providers built via `createWsJsonRpcProvider`). Clients and
  // refcounts are preserved; tracked subscriptions are re-sent on
  // `resumeAll` via the replay wrapper.
  pauseAll(): void;
  resumeAll(): void;
  // Rebuild the transport of the chains named by `genesisHashes`, or of every
  // chain currently held when it is omitted. `createProvider` runs again, so a
  // host that picks its transport from settings (a light client versus RPC
  // nodes, say) applies the new choice here.
  //
  // Pooled clients, resolved apis and refcounts all survive: consumers keep the
  // references they already hold and see the same interruption a dropped socket
  // would have caused. A chain the pool never connected to is skipped. A chain
  // still waiting out `destroyDelay` is destroyed rather than restarted: nobody
  // holds it, so its next acquire builds lanes from the current settings.
  //
  // The old transports close at once, the new ones come up on the reconnect
  // backoff; see `restart` in `createRestartableProvider`.
  reconnect(genesisHashes?: readonly string[]): void;
};

/**
 * Creates the chain connection pool. Each consumer of a chain gets its own session: its own request
 * ids and subscription tokens, and a home connection that stays open while the consumer is connected.
 * A follow is placed on a connection holding fewer than `followLimit(chain)` follows; when none has
 * room, a new connection opens, and it closes once empty.
 */
export function createChainConnection<C extends ChainConfig, T = PolkadotClient>({
  resolve,
  clientOptions,
  createProvider,
  followLimit,
  createClient: makeClient = createClient,
  destroyDelay = 0,
}: ChainConnectionConfig<C, T>): ChainConnection<C, T> {
  const connections = createConnectionManager();
  const refCounter = createRefCounter<string>();
  const entries = new Map<string, PoolEntry>();
  let paused = false;
  // Names each `getProvider` session, never reused for the pool's life.
  let nextLocalSession = 0;

  const resolvedApis = new Map<string, { resolved: T; polkadotClient: PolkadotClient }>();
  const pendingResolutions = new Map<string, { promise: Promise<T>; polkadotClient: PolkadotClient }>();
  const destructionTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const cancelDestructionTimer = (genesisHash: string) => {
    const timer = destructionTimers.get(genesisHash);
    if (timer !== undefined) {
      clearTimeout(timer);
      destructionTimers.delete(genesisHash);
    }
  };

  const createLaneTransport = (chain: C, onLaneStatus: (status: ConnectionStatus) => void): RestartableJsonRpcProvider => {
    // A provider replaced by `reconnect` can still report a trailing
    // `disconnected` while its successor is already connecting, so status is
    // scoped to the generation that produced it and stale updates are dropped.
    let generation = 0;
    return createRestartableProvider(onHalt => {
      const current = ++generation;
      const update = (status: ConnectionStatus) => {
        if (current === generation) onLaneStatus(status);
      };

      try {
        return createProvider(chain, update, onHalt);
      } catch (error) {
        // The bump above already muted the previous transport's updates, so a
        // factory that throws would otherwise leave the chain reporting the
        // status of a transport that no longer exists. `createRestartableProvider`
        // retries, and the next attempt reports for itself.
        update('disconnected');
        throw error;
      }
    });
  };

  const getOrCreateEntry = (chain: C): PoolEntry => {
    const existing = entries.get(chain.genesisHash);
    if (existing) return existing;

    const options = clientOptions?.(chain);
    const lanes = createChainLanes({
      label: chain.genesisHash,
      createTransport: onLaneStatus => createLaneTransport(chain, onLaneStatus),
      followLimit: () => followLimit(chain),
      warn: createBrokerWarner(),
      paused,
      onStatus: status => connections.update(chain.genesisHash, status),
    });
    // The lanes report changes only, so the status they start in is seeded here.
    connections.update(chain.genesisHash, lanes.status());

    let client: PolkadotClient;
    try {
      client = makeClient(onMessage => lanes.connect({ sessionId: 'client', onMessage }), options);
    } catch (error) {
      lanes.disconnectAll();
      throw error;
    }
    const entry: PoolEntry = { client, lanes };
    entries.set(chain.genesisHash, entry);
    return entry;
  };

  const destroyClient = (genesisHash: string) => {
    cancelDestructionTimer(genesisHash);

    const entry = entries.get(genesisHash);
    if (entry) {
      entries.delete(genesisHash);
      try {
        entry.client.destroy();
      } finally {
        entry.lanes.disconnectAll();
      }
    }
    resolvedApis.delete(genesisHash);
    pendingResolutions.delete(genesisHash);
  };

  // eslint-disable-next-line @typescript-eslint/require-await -- a throw must become a rejection, which `getProvider`'s `.catch` answers
  const rawAcquire = async (chain: C) => {
    try {
      if (destroyDelay > 0) cancelDestructionTimer(chain.genesisHash);

      refCounter.increment(chain.genesisHash);
      const entry = getOrCreateEntry(chain);

      return {
        entry,
        unlock() {
          if (refCounter.decrement(chain.genesisHash) === 0) {
            if (destroyDelay === 0) {
              destroyClient(chain.genesisHash);
            } else {
              const timer = setTimeout(() => {
                destroyClient(chain.genesisHash);
              }, destroyDelay);
              destructionTimers.set(chain.genesisHash, timer);
            }
          }
        },
      };
    } catch (error) {
      if (refCounter.decrement(chain.genesisHash) === 0) {
        destroyClient(chain.genesisHash);
      }
      throw error;
    }
  };

  const resolveApi = async (chain: C, polkadotClient: PolkadotClient): Promise<T> => {
    const existing = resolvedApis.get(chain.genesisHash);
    if (existing && existing.polkadotClient === polkadotClient) return existing.resolved;

    const pending = pendingResolutions.get(chain.genesisHash);
    if (pending && pending.polkadotClient === polkadotClient) return pending.promise;

    const promise = (async () => {
      const resolved = await resolve(chain, polkadotClient);
      resolvedApis.set(chain.genesisHash, { resolved, polkadotClient });
      return resolved;
    })();

    pendingResolutions.set(chain.genesisHash, { promise, polkadotClient });
    // `.finally` passes a rejection on to a promise of its own. The caller handles it through `promise`, so this
    // copy is dropped.
    promise.finally(() => pendingResolutions.delete(chain.genesisHash)).catch(noop);
    return promise;
  };

  return {
    async lockApi(chain) {
      const { entry, unlock } = await rawAcquire(chain);

      try {
        const api = await resolveApi(chain, entry.client);
        return { api, unlock };
      } catch (error) {
        unlock();
        resolvedApis.delete(chain.genesisHash);
        pendingResolutions.delete(chain.genesisHash);
        throw error;
      }
    },

    getProvider(chain) {
      return getSyncProvider(onResult => {
        let teardownCalled = false;
        let pendingUnlock: VoidFunction | null = null;

        // Idempotent: subsequent calls (e.g. teardown after disconnect) are no-ops.
        const releaseUnlock = () => {
          const unlock = pendingUnlock;
          pendingUnlock = null;
          unlock?.();
        };

        // Neither branch answers `onResult` after a teardown: `getSyncProvider` reads `null` as a failed connect and
        // retries even after `disconnect`, taking a lease nobody returns, which also cancels a pending destruction.
        rawAcquire(chain)
          .then(({ entry, unlock }) => {
            if (teardownCalled) {
              unlock();
              return;
            }
            pendingUnlock = unlock;
            onResult(onMessage => {
              const sessionId = `local:${String(nextLocalSession)}`;
              nextLocalSession += 1;
              const connection = entry.lanes.connect({ sessionId, onMessage });
              return {
                send: connection.send,
                disconnect() {
                  try {
                    connection.disconnect();
                  } finally {
                    releaseUnlock();
                  }
                },
              };
            });
          })
          .catch(() => {
            if (!teardownCalled) onResult(null);
          });

        // Covers teardown without disconnect, and teardown before acquire resolves.
        return () => {
          teardownCalled = true;
          releaseUnlock();
        };
      });
    },

    status(genesisHash) {
      return connections.getConnectionStatus(genesisHash);
    },

    onStatusChanged(genesisHash, callback) {
      return connections.onStatusChange(genesisHash, callback);
    },

    pauseAll() {
      paused = true;
      runEvery(
        [...entries.values()].map(({ lanes }) => () => {
          lanes.pause();
        }),
        'pauseAll failed on several chains',
      );
    },

    resumeAll() {
      paused = false;
      runEvery(
        [...entries.values()].map(({ lanes }) => () => {
          lanes.resume();
        }),
        'resumeAll failed on several chains',
      );
    },

    reconnect(genesisHashes) {
      const steps: (() => void)[] = [];
      for (const [genesisHash, { lanes }] of entries) {
        if (genesisHashes && !genesisHashes.includes(genesisHash)) continue;
        // Nobody holds a chain waiting out `destroyDelay`, so it is closed rather than restarted: a restart would open a
        // socket only for the timer to discard it, and keeping it would hand a re-acquire inside the delay the old
        // transport. Its next acquire builds lanes from the current settings.
        if (destructionTimers.has(genesisHash)) {
          steps.push(() => {
            destroyClient(genesisHash);
          });
          continue;
        }

        steps.push(() => {
          lanes.restart();
        });
      }
      runEvery(steps, 'reconnect failed on several chains');
    },
  };
}
