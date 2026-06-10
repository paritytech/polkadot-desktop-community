import { useMemo } from 'react';

import { type PersistedProduct, productService, usePersistedProducts } from '@/domains/product';

export const useFilteredProducts = (query: string, recentIds: string[]) => {
  const { data: allProducts } = usePersistedProducts();

  return useMemo(() => {
    const recentIdSet = new Set(recentIds);

    const recentProducts = recentIds
      .map(id => allProducts.find(p => p.baseName === id))
      .filter((p): p is PersistedProduct => p !== undefined)
      .slice(0, 6);

    // Under the new model every row in `products` is a committed product, so
    // "installed" is just every persisted product.
    const installed = allProducts;
    const installedIdSet = new Set(installed.map(p => p.baseName));

    if (query) {
      const excludeIds = new Set([...recentIdSet, ...installedIdSet]);
      const results = allProducts.filter(p => productService.matchesQuery(p, query) && !excludeIds.has(p.baseName));
      const allItems = [...recentProducts, ...installed, ...results];

      return { recentProducts, installed, results, allItems };
    }

    const allItems = [...recentProducts, ...installed];

    return { recentProducts, installed, results: [], allItems };
  }, [query, recentIds, allProducts]);
};
