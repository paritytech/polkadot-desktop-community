import { getSyncProvider } from '@polkadot-api/json-rpc-provider-proxy';
import { type JsonRpcProvider, type PolkadotClient, createClient } from 'polkadot-api';

import { createBranchedProvider } from './createBranchedProvider';
import { createConnectionManager } from './createConnectionManager';
import { createRefCounter } from './createRefCounter';
import { createRestartableProvider } from './createRestartableProvider';
import { type ChainConfig, type ConnectionStatus, type PooledClient } from './types';

export type ChainConnectionConfig<C extends ChainConfig, T = PolkadotClient> = {
  createProvider(chain: C, onStatusChanged: (status: ConnectionStatus) => void): JsonRpcProvider;
  clientOptions?(chain: C): Parameters<typeof createClient>[1];
  // Defaults to polkadot-api's `createClient`. An injection point for tests and for wrapping client construction — polkadot-api is imported either way.
  createClient?: typeof createClient;
  resolve(chain: C, client: PolkadotClient): Promise<T>;
  destroyDelay?: number;
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
  // would have caused. A chain nobody holds is skipped — one the pool never
  // connected to, and one still waiting out `destroyDelay` — and picks the new
  // transport up when it is next acquired.
  //
  // The old transports close at once, the new ones come up on the reconnect
  // backoff; see `restart` in `createRestartableProvider`.
  reconnect(genesisHashes?: readonly string[]): void;
};

export function createChainConnection<C extends ChainConfig, T = PolkadotClient>({
  resolve,
  clientOptions,
  createProvider,
  createClient: makeClient = createClient,
  destroyDelay = 0,
}: ChainConnectionConfig<C, T>): ChainConnection<C, T> {
  const connections = createConnectionManager();
  const refCounter = createRefCounter<string>();
  const existingClients = new Map<string, PooledClient>();

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

  const getOrCreateClient = (chain: C): PooledClient => {
    const existing = existingClients.get(chain.genesisHash);
    if (existing) return existing;

    // A provider replaced by `reconnect` can still report a trailing
    // `disconnected` while its successor is already connecting, so status is
    // scoped to the generation that produced it and stale updates are dropped.
    let generation = 0;
    const rootProvider = createRestartableProvider(() => {
      const current = ++generation;
      const update = (status: ConnectionStatus) => {
        if (current === generation) connections.update(chain.genesisHash, status);
      };

      try {
        return createProvider(chain, update);
      } catch (error) {
        // The bump above already muted the previous transport's updates, so a
        // factory that throws would otherwise leave the chain reporting the
        // status of a transport that no longer exists. `createRestartableProvider`
        // retries, and the next attempt reports for itself.
        update('disconnected');
        throw error;
      }
    });
    const branchedProvider = createBranchedProvider(rootProvider);
    const client = makeClient(branchedProvider.branch(), clientOptions?.(chain));

    const pooled: PooledClient = { client, provider: branchedProvider, rootProvider };
    existingClients.set(chain.genesisHash, pooled);
    return pooled;
  };

  const destroyClient = (genesisHash: string) => {
    cancelDestructionTimer(genesisHash);

    const pooled = existingClients.get(genesisHash);
    if (pooled) {
      existingClients.delete(genesisHash);
      connections.update(genesisHash, 'disconnected');
      pooled.client.destroy();
    }
    resolvedApis.delete(genesisHash);
    pendingResolutions.delete(genesisHash);
  };

  const rawAcquire = async (chain: C) => {
    try {
      if (destroyDelay > 0) cancelDestructionTimer(chain.genesisHash);

      refCounter.increment(chain.genesisHash);
      const pooled = getOrCreateClient(chain);

      return {
        pooled,
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
    promise.finally(() => pendingResolutions.delete(chain.genesisHash));
    return promise;
  };

  return {
    async lockApi(chain) {
      const { pooled, unlock } = await rawAcquire(chain);

      try {
        const api = await resolveApi(chain, pooled.client);
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

        rawAcquire(chain)
          .then(({ pooled, unlock }) => {
            if (teardownCalled) {
              unlock();
              onResult(null);
              return;
            }
            pendingUnlock = unlock;
            onResult((onMessage, _onHalt) => pooled.provider.branch(releaseUnlock)(onMessage));
          })
          .catch(() => {
            onResult(null);
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
      for (const { rootProvider } of existingClients.values()) {
        rootProvider.pause();
      }
    },

    resumeAll() {
      for (const { rootProvider } of existingClients.values()) {
        rootProvider.resume();
      }
    },

    reconnect(genesisHashes) {
      for (const [genesisHash, { rootProvider }] of existingClients) {
        if (genesisHashes && !genesisHashes.includes(genesisHash)) continue;
        // Nobody holds this one any more — it is only waiting out `destroyDelay`.
        // Rebuilding its transport would open a socket the destruction timer is
        // about to throw away.
        if (destructionTimers.has(genesisHash)) continue;

        rootProvider.restart();
      }
    },
  };
}
