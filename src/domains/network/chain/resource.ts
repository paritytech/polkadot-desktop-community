import { firstValueFrom } from 'rxjs';

import { createQueryResource } from '@/shared/resource';
import { REMOTE_CONFIG_KEYS, remoteConfigGateway, remoteConfigReady } from '@/domains/remote-config';

import { remoteChainsSchema } from './schemas';
import { chainService } from './service';
import { type Chain } from './types';

// Single chain catalog from Remote Config (`chains_v2`). No fallback: the request
// THROWS when RC is unavailable so the empty result is never cached under
// `staleAfter: Infinity` — a rejected request retries on the next read.
export const chainResource = createQueryResource<object>({
  key: () => 'chains',
})
  .request<Chain[]>(async () => {
    await remoteConfigReady;
    const raw = remoteConfigGateway.tryGetJson(REMOTE_CONFIG_KEYS.chains, remoteChainsSchema);
    if (!raw) throw new Error('[network] Remote Config "chains_v2" unavailable');
    return chainService.sortChains(chainService.fromRemoteChains(raw));
  })
  .cache<Chain[]>({
    initial: [],
    staleAfter: Number.POSITIVE_INFINITY,
    map: (_, chains) => chains,
  })
  .build();

// Non-React read for use cases / other domains; shares the resource's single
// fetch + transform with every UI chain list.
export async function getChains(): Promise<Chain[]> {
  return firstValueFrom(chainResource.read$({}));
}
