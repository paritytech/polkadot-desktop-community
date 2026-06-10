import { createQueryResource, createStreamResource } from '@/shared/resource';
import { resolveProductUseCase } from '../$usecase/resolve';
import { dotNsService } from '../dotns/service';

import { type PersistedProduct, productDb } from './repository';
import { type Product } from './types';

export const productsResource = createStreamResource({
  key: () => 'products',
})
  .subscribe<PersistedProduct[]>(() => productDb.subscribeToAll())
  .cache<PersistedProduct[]>({
    initial: [],
    map(_, products) {
      return products;
    },
  })
  .build();

// Pure chain-resolution cache: resolves an identifier from the chain into memory
// with NO DB read. It is only ever invoked for products that are NOT committed —
// committed products are served from `productsResource` (the live DB) via
// `usePersistedProduct*`, so a committed product never lands in this cache and
// the two can't duplicate or diverge. 1-minute staleness bounds repeat chain
// hits while a long-lived UI keeps an uncommitted identifier mounted.
//
// A resource over a use case (the documented carve-out): `fetchProductFromChain`
// is a genuinely multi-source read (resolver + manifest + per-executable
// subnames), and this resource adds nothing but caching.
//
// Keyed by `baseNameOf(identifier)` so case/suffix variants (`Foo.dot`, `foo`)
// collapse to one entry and commitment's `invalidateChainResolve(baseName)` lands
// on the exact key a hook caller stored under.
export const chainResolveResource = createQueryResource<{ identifier: string }>({
  key: ({ identifier }) => `chain:${dotNsService.baseNameOf(identifier)}`,
})
  .request<Product | null>(({ identifier }) => resolveProductUseCase.fetchProductFromChain(dotNsService.baseNameOf(identifier)))
  .timeout(60_000)
  .cache<Record<string, Product | null>>({
    staleAfter: 60_000,
    initial: {},
    map(cache, value, { identifier }) {
      return { ...cache, [dotNsService.baseNameOf(identifier)]: value };
    },
  })
  .build();

// Evicts the chain-resolve entry for an identifier. Called by commitment use
// cases once an identifier becomes committed, so the now-redundant in-memory
// chain copy is dropped and reads fall through to the live DB row.
export function invalidateChainResolve(identifier: string): void {
  chainResolveResource.invalidate({ identifier });
}
