import { type Observable, map, take } from 'rxjs';

import { createStreamResource } from '@/shared/resource';
import { type GenesisHash } from '../chain/types';

import { customChainRepository } from './repository';
import { type CustomChainEntry, type CustomChainsRecord } from './types';

export const customChainsResource = createStreamResource<object>({
  key: () => 'all',
})
  .subscribe<CustomChainsRecord>(() => customChainRepository.entries$.value$)
  .cache<CustomChainsRecord>({
    initial: {},
    map: (_, value) => value,
  })
  .build();

export function addCustomChain({ chainId, entry }: { chainId: GenesisHash; entry: CustomChainEntry }): Observable<null> {
  return customChainRepository.add(chainId, entry).pipe(
    map(() => null),
    take(1),
  );
}

export function removeCustomChain({ chainId }: { chainId: GenesisHash }): Observable<null> {
  return customChainRepository.remove(chainId).pipe(
    map(() => null),
    take(1),
  );
}
