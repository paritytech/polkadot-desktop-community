import {
  createChainConnection,
  createMetadataCache,
  createWsJsonRpcProvider,
} from '@novasamatech/host-substrate-chain-connection';
import { createLocalStorageAdapter } from '@novasamatech/storage-adapter';
import { NEVER, Observable, defer, switchMap } from 'rxjs';

import { appActive$ } from '@/shared/utils';
import { type Chain } from '../chain/types';

import { createLightClientProvider, hasLightClientSupport } from './lightClient';
import { type ChainApi, type TypedClient } from './types';

const metadataCache = createMetadataCache({
  storage: createLocalStorageAdapter('chain-metadata'),
});

const chains = createChainConnection<Chain, TypedClient>({
  destroyDelay: 60 * 1000,
  createProvider: (chain, onStatusChanged) => {
    if (hasLightClientSupport(chain.genesisHash)) {
      onStatusChanged('connected');
      return createLightClientProvider(chain.genesisHash);
    }

    return createWsJsonRpcProvider({
      endpoints: chain.nodes.map(node => node.url),
      onStatusChanged,
    });
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
