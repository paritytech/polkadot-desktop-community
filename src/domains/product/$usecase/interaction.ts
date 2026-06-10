import { type Observable, catchError, combineLatest, debounceTime, map, of, startWith } from 'rxjs';

import { allAliasPermissionsResource } from '../alias-permissions/resource';
import { type AliasPermission } from '../alias-permissions/types';
import { dotNsService } from '../dotns/service';
import { allProductPermissionsResource } from '../permissions/resource';
import { type ProductPermissions } from '../permissions/types';
import { productsResource } from '../product/resource';
import { type Product } from '../product/types';

// Use-case-local composition type (multi-module: product + permissions + alias-permissions).
// A discriminated union per interacted product: committed entries carry the
// resolved `Product`; permission-only entries carry just the stored raw id
// (display resolution is the consumer's concern — see `useDisplayedProduct`).
export type InteractedProduct = { kind: 'committed'; product: Product } | { kind: 'permissionOnly'; productId: string };

// Reset flows can leave a persisted row with no standing decision
// (`{ productId, devicePermissions: [], remotePermissions: [] }`) — such a row
// is not an interaction.
function holdsDecision(row: ProductPermissions): boolean {
  return row.devicePermissions.length > 0 || row.remotePermissions.length > 0;
}

// Ids of interacted products that are NOT committed — permission rows holding a
// decision, plus alias requesters — deduped and sorted for a deterministic order.
//
// Permission/alias rows store the raw webview identifier, while a committed
// `baseName` is always `baseNameOf()`-normalized — so membership is compared on
// the normalized form, but the *stored raw id* is emitted: detail-page lookups
// (`useProductPermissions(id)`) key on the raw row id.
function collectPermissionOnlyIds(
  products: Product[],
  permissions: ProductPermissions[],
  aliasPermissions: AliasPermission[],
): string[] {
  const committed = new Set(products.map(product => dotNsService.baseNameOf(product.baseName)));
  const idByBaseName = new Map<string, string>();

  function add(rawId: string) {
    const baseName = dotNsService.baseNameOf(rawId);
    if (committed.has(baseName)) return;
    if (!idByBaseName.has(baseName)) idByBaseName.set(baseName, rawId);
  }

  for (const row of permissions) {
    if (holdsDecision(row)) add(row.productId);
  }
  for (const alias of aliasPermissions) {
    add(alias.requesterProductId);
  }

  return [...idByBaseName.values()].sort((a, b) => a.localeCompare(b));
}

// A permission store is supplementary to the committed-products list: it must
// not hold the whole list back (combineLatest waits for every source's first
// value) nor collapse it (one corrupt row erroring the stream would otherwise
// error the combined stream). Seed with [] and degrade to [] on error.
function supplementary<T>(stream$: Observable<T[]>): Observable<T[]> {
  return stream$.pipe(
    catchError(() => of<T[]>([])),
    startWith<T[]>([]),
  );
}

// Live-updating read over three same-domain stores: committed products plus
// every product that has any stored permission decision (device/remote row or
// an alias grant as requester), regardless of status.
function watchInteractedProducts(): Observable<InteractedProduct[]> {
  return combineLatest([
    productsResource.read$({}),
    supplementary(allProductPermissionsResource.read$({})),
    supplementary(allAliasPermissionsResource.read$({})),
  ]).pipe(
    // Coalesce the synchronous seed/value burst (combineLatest glitch frames)
    // into one emission carrying every source's settled value.
    debounceTime(0),
    map(([products, permissions, aliasPermissions]) => {
      // Committed entries first, then the sorted permission-only ids — a stable
      // order so consumers can render the union as-is without re-sorting.
      const committed = products.map((product): InteractedProduct => ({ kind: 'committed', product }));
      const permissionOnly = collectPermissionOnlyIds(products, permissions, aliasPermissions).map(
        (productId): InteractedProduct => ({ kind: 'permissionOnly', productId }),
      );

      return [...committed, ...permissionOnly];
    }),
  );
}

export const interactionUseCase = {
  watchInteractedProducts,
};
