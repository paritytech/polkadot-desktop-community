import { createLocalStorageAdapter } from '@novasamatech/storage-adapter';
import { NEVER, Observable, defer, pairwise, switchMap } from 'rxjs';

import { createChainConnection, createMetadataCache, createWsJsonRpcProvider } from '@/shared/chain-connection';
import { appActive$ } from '@/shared/utils';
import { type Chain } from '../chain/types';
import { connectionRepository } from '../connection/repository';
import { connectionService } from '../connection/service';

import { LIGHT_CLIENT_FOLLOW_LIMIT, RPC_FOLLOW_LIMIT } from './constants';
import { createLightClientProvider, ensureLightClientCatalog, hasLightClientSupport } from './lightClient';
import { type ChainApi, type TypedClient } from './types';

const metadataCache = createMetadataCache({
  storage: createLocalStorageAdapter('chain-metadata'),
});

// Read on every call, not once per chain: `initConnectionModeSwitch` has the
// pool rebuild a transport when the settings change, and this is where the new
// choice is picked up.
function usesLightClient(chain: Chain): boolean {
  const settings = connectionRepository.getSettings();
  return connectionService.resolveMode(settings, chain.genesisHash, hasLightClientSupport(chain.genesisHash)) === 'light-client';
}

const chains = createChainConnection<Chain, TypedClient>({
  destroyDelay: 60 * 1000,
  createProvider: (chain, onStatusChanged, onHalt) => {
    if (usesLightClient(chain)) {
      return createLightClientProvider(chain.genesisHash, onStatusChanged, onHalt);
    }

    return createWsJsonRpcProvider({
      endpoints: chain.nodes.map(node => node.url),
      onStatusChanged,
    });
  },
  followLimit(chain) {
    return usesLightClient(chain) ? LIGHT_CLIENT_FOLLOW_LIMIT : RPC_FOLLOW_LIMIT;
  },
  clientOptions(chain) {
    // Key the (persisted) metadata cache by the stable genesis hash, not the
    // chains_v2 label, so a label change never orphans the cached metadata.
    return metadataCache.forChain(chain.genesisHash);
  },
  async resolve(_chain, client) {
    // Runtime uses the UNSAFE api — no descriptor metadata is loaded. Descriptors
    // are a typing-only generic supplied by call sites (see requestApi/lockApi).
    const api: ChainApi = client.getUnsafeApi();
    const staticApi = await api.getStaticApis();
    await client.getBestBlocks();

    return { api, staticApi, client };
  },
});

// breaks WS connections if app is stale
// Called explicitly from bootstrap so the bundler does not eliminate it under
// the project-wide `sideEffects: ["*.css"]` declaration in package.json.
export const initChainConnectionLifecycle = (): VoidFunction => {
  const subscription = appActive$.subscribe(status => {
    if (status) {
      chains.resumeAll();
    } else {
      chains.pauseAll();
    }
  });
  return () => subscription.unsubscribe();
};

/**
 * Carries a connection-settings edit through to the connections that are
 * already open. Without it the pool would keep serving whatever transport each
 * network was first locked onto, and the only way to apply a change would be to
 * restart the renderer.
 *
 * Networks the pool is not currently holding need nothing done: they read the
 * settings when they are next acquired.
 */
export const initConnectionModeSwitch = (): VoidFunction => {
  const subscription = connectionRepository.settings$.value$.pipe(pairwise()).subscribe(([previous, next]) => {
    const affected = connectionService.chainsAffectedBy(previous, next);
    if (affected !== 'all' && affected.length === 0) return;

    // Boot skips the light-client catalog while the preference is `rpc`, so a
    // switch INTO the light client has to load it before the pool rebuilds —
    // `createProvider` reads `hasLightClientSupport` synchronously, and an empty
    // catalog would resolve every network straight back to RPC. Reconnect either
    // way: a catalog that cannot load is a fallback to RPC, not a reason to leave
    // the connections on the transport the user just switched away from.
    const catalogReady = connectionService.mayUseLightClient(next) ? ensureLightClientCatalog() : Promise.resolve();

    void catalogReady
      .catch((error: unknown) => {
        console.error('[network] light-client catalog unavailable — the switch falls back to RPC', error);
      })
      .then(() => {
        chains.reconnect(affected === 'all' ? undefined : affected);
      });
  });

  return () => subscription.unsubscribe();
};

// Hard timeout for any single chain call. The chain layer waits for refollow
// after pause/resume; if a refollow takes unusually long the inner callback
// can hang indefinitely and `unlock()` never runs, blocking every subsequent
// `lockApi(chain)` for the same chain. Bound the wait so the lock is always
// released, surfaces a recoverable error, and lets the next request through.
const CHAIN_REQUEST_TIMEOUT_MS = 30_000;

export const chainRegistry = {
  ...chains,

  // Hands back the untyped chain api (no descriptor loaded). A call site that
  // needs typed pallet access narrows `api` to its descriptor via `ChainApiFor`.
  async requestApi<Return>(chain: Chain, callback: (api: TypedClient) => Return): Promise<Awaited<Return>> {
    const { api, unlock } = await chains.lockApi(chain);

    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race<Awaited<Return>>([
        Promise.resolve(callback(api)),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`Chain request timed out after ${CHAIN_REQUEST_TIMEOUT_MS}ms`)),
            CHAIN_REQUEST_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (timer !== null) clearTimeout(timer);
      unlock();
    }
  },

  api$(chain: Chain): Observable<TypedClient> {
    return appActive$.pipe(
      switchMap(active =>
        active
          ? defer(() => chainRegistry.lockApi(chain)).pipe(
              switchMap(
                ({ api, unlock }) =>
                  new Observable<TypedClient>(subscriber => {
                    subscriber.next(api);
                    return () => unlock();
                  }),
              ),
            )
          : NEVER,
      ),
    );
  },
};
