import { getSyncProvider } from '@polkadot-api/json-rpc-provider-proxy';
import { type JsonRpcProvider, type PolkadotClient, createClient } from 'polkadot-api';
import { type Subscription } from 'rxjs';

import { createBrokerWarner } from './createBrokerWarner';
import { type ChainLanes, createChainLanes } from './createChainLanes';
import { createConnectionManager } from './createConnectionManager';
import { createRefCounter } from './createRefCounter';
import { type RestartableJsonRpcProvider, createRestartableProvider } from './createRestartableProvider';
import { noop } from './noop';
import { runEvery } from './runEvery';
import { type ChainActivity, type ChainConfig, type ChainPoolWatcher, type ConnectionStatus } from './types';

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

type PoolEntry<C extends ChainConfig> = {
  chain: C;
  client: PolkadotClient;
  lanes: ChainLanes;
  // The client's best blocks, followed while a watcher is registered.
  blocks: Subscription | null;
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
  /**
   * Replays every chain the pool holds to `watcher` during the call, then reports each later change of a chain's
   * leases, status or entry, and each new best block of a held chain. Opens no chain and keeps none open: a chain
   * leaves the pool on its last lease's release whether watched or not. Returns the stop function.
   */
  watch(watcher: ChainPoolWatcher<C>): VoidFunction;
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
  const entries = new Map<string, PoolEntry<C>>();
  const watchers = new Set<ChainPoolWatcher<C>>();
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

  // A watcher that throws must not keep the pool or the other watchers from going on.
  const tellWatcher = (watcher: ChainPoolWatcher<C>, tell: (watcher: ChainPoolWatcher<C>) => void) => {
    try {
      tell(watcher);
    } catch (error) {
      console.error('[chain-connection] a pool watcher threw', error);
    }
  };

  const tellWatchers = (tell: (watcher: ChainPoolWatcher<C>) => void) => {
    // A copy, so a watcher that stops while it is told does not change the set being walked.
    for (const watcher of [...watchers]) {
      tellWatcher(watcher, tell);
    }
  };

  const readActivity = (chain: C): ChainActivity<C> => ({
    chain,
    consumers: refCounter.refs(chain.genesisHash),
    status: connections.getConnectionStatus(chain.genesisHash),
    following: entries.has(chain.genesisHash),
  });

  const reportActivity = (chain: C) => {
    if (watchers.size === 0) return;
    const activity = readActivity(chain);
    tellWatchers(watcher => {
      watcher.onActivity(activity);
    });
  };

  const followBlocks = (entry: PoolEntry<C>) => {
    if (watchers.size === 0 || entry.blocks !== null) return;
    const { genesisHash } = entry.chain;
    const subscription = entry.client.bestBlocks$.subscribe({
      next(blocks) {
        const best = blocks[0];
        if (best === undefined) return;
        tellWatchers(watcher => {
          watcher.onBestBlock(genesisHash, best.number);
        });
      },
      error(error: unknown) {
        console.warn(`[chain-connection] best blocks failed for ${genesisHash}`, error);
        entry.blocks = null;
      },
    });
    // A stream that ends during `subscribe` leaves nothing to hold, and a later `connected` follows it again.
    entry.blocks = subscription.closed ? null : subscription;
  };

  const unfollowBlocks = (entry: PoolEntry<C>) => {
    entry.blocks?.unsubscribe();
    entry.blocks = null;
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

  const getOrCreateEntry = (chain: C): PoolEntry<C> => {
    const existing = entries.get(chain.genesisHash);
    if (existing) return existing;

    const options = clientOptions?.(chain);
    const lanes = createChainLanes({
      label: chain.genesisHash,
      createTransport: onLaneStatus => createLaneTransport(chain, onLaneStatus),
      followLimit: () => followLimit(chain),
      warn: createBrokerWarner(),
      paused,
      onStatus: status => {
        connections.update(chain.genesisHash, status);
        // Lanes closing after their entry left report nothing: the entry's destruction reports the chain's last state.
        const entry = entries.get(chain.genesisHash);
        if (!entry) return;
        reportActivity(chain);
        if (status === 'connected') followBlocks(entry);
      },
    });
    // The lanes report changes only, so the status they start in is seeded here. The lease that built the entry
    // reports it.
    connections.update(chain.genesisHash, lanes.status());

    let client: PolkadotClient;
    try {
      client = makeClient(onMessage => lanes.connect({ sessionId: 'client', onMessage }), options);
    } catch (error) {
      lanes.disconnectAll();
      throw error;
    }
    const entry: PoolEntry<C> = { chain, client, lanes, blocks: null };
    entries.set(chain.genesisHash, entry);
    followBlocks(entry);
    return entry;
  };

  const destroyClient = (genesisHash: string) => {
    cancelDestructionTimer(genesisHash);

    const entry = entries.get(genesisHash);
    if (entry) {
      entries.delete(genesisHash);
      unfollowBlocks(entry);
      try {
        entry.client.destroy();
      } finally {
        entry.lanes.disconnectAll();
        reportActivity(entry.chain);
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
      reportActivity(chain);

      return {
        entry,
        unlock() {
          const consumers = refCounter.decrement(chain.genesisHash);
          reportActivity(chain);
          if (consumers === 0) {
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

    watch(watcher) {
      watchers.add(watcher);
      for (const entry of entries.values()) {
        const activity = readActivity(entry.chain);
        tellWatcher(watcher, heard => {
          heard.onActivity(activity);
        });
        followBlocks(entry);
      }

      return () => {
        watchers.delete(watcher);
        if (watchers.size > 0) return;
        for (const entry of entries.values()) {
          unfollowBlocks(entry);
        }
      };
    },
  };
}
