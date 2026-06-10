import { useMemo } from 'react';

import { useRead } from '@/shared/hooks';
import { nonNullable } from '@/shared/utils';
import { dotNsService } from '../dotns/service';

import { useProductIcon } from './manifest/hooks';
import { chainResolveResource, productsResource } from './resource';
import { type Product } from './types';

export type ProductHeaderViewModel = {
  name: string;
  description?: string;
  iconSrc?: string;
};

export function useProductHeaderProps(options: {
  product: Nullable<Product>;
  fallbackName?: string;
  fallbackDomain?: string;
}): ProductHeaderViewModel {
  const { product, fallbackName = '', fallbackDomain = fallbackName } = options;
  const { data: iconUrl } = useProductIcon(product?.icon ?? null);
  const name = product?.displayName ?? fallbackName;
  const domain = product?.baseName ?? fallbackDomain;

  return {
    name,
    // `ProductHeader` renders `description` only when it's non-empty and differs
    // from `name`, so no need to pre-filter the equal/empty case here.
    description: domain,
    iconSrc: iconUrl ?? undefined,
  };
}

// Internal: resolve an identifier purely from the chain into memory (no DB).
// `useDisplayedProduct` is the public entry point; this is its fallback for
// identifiers with no committed row.
function useChainResolvedProduct(identifier: Nullable<string>) {
  return useRead(chainResolveResource, {
    params: identifier ? { identifier } : null,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowing null to typed defaultValue
    defaultValue: null as Product | null,
    map: (cache, params) => (params ? (cache[dotNsService.baseNameOf(params.identifier)] ?? null) : null),
  });
}

// Every row in `products` is a committed (installed) product, so "all products"
// and "installed products" are the same set — one hook covers both.
export const usePersistedProducts = () => {
  return useRead(productsResource, {
    params: {},
    defaultValue: [],
  });
};

export const useIsProductInstalled = (productId: string | null) => {
  const { data: products } = usePersistedProducts();

  return useMemo(() => {
    if (!productId) return false;
    // Under the new model every row in `products` is a committed product —
    // existence of the row IS the commitment.
    return products.some(p => p.baseName === productId);
  }, [productId, products]);
};

export const usePersistedProductById = (productId: Nullable<string>) => {
  const { data: products, pending, error } = usePersistedProducts();

  const product = useMemo(() => {
    if (!productId) return null;
    return products.find(p => p.baseName === productId) ?? null;
  }, [productId, products]);

  return { data: product, pending, error };
};

// The public "give me the product for this identifier, committed or not" hook —
// committed row from the live DB if present, else resolved from chain into
// memory. THE entry point for any screen that shows a product by id (tabs,
// address bar, dialogs, settings, webview). Returns the standard resource-hook
// shape; `data` is null until at least one source resolves.
export function useDisplayedProduct(productId: Nullable<string>): { data: Product | null; pending: boolean; error: unknown } {
  const { data: persisted, pending: persistedPending, error: persistedError } = usePersistedProductById(productId);
  // Resolve from chain only for identifiers with no committed row — committed
  // products are served from the live DB above and never enter the chain cache,
  // so the two reads can't duplicate or diverge.
  const {
    data: chain,
    pending: chainPending,
    error: chainError,
  } = useChainResolvedProduct(persistedPending || nonNullable(persisted) ? null : productId);

  return {
    data: persisted ?? chain,
    pending: persistedPending || chainPending,
    error: persistedError ?? chainError,
  };
}

export function useIsPinned(productId: Nullable<string>): boolean {
  const { data: record } = usePersistedProductById(productId);
  return record?.pinned ?? false;
}
