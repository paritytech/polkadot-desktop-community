import { useSession } from '@novasamatech/host-papp-react-ui';
import { toHex } from '@novasamatech/scale';
import { useMemo } from 'react';

import { useRxState } from '@/shared/rxstate';
import { usePersistedProducts } from '@/domains/product';
import { browserTabs } from '@/aggregates/browser-tabs';
import { ProductWorker } from '@/widgets/ProductWorker';
import { resolveTabProductIdTransformer } from '../di';

import { OpenTabProductWorker } from './OpenTabProductWorker';

export const WorkersManager = () => {
  const { session } = useSession();
  const { data: products } = usePersistedProducts();
  const [tabs] = useRxState(browserTabs.tabs$);
  const accountId = session ? toHex(session?.localAccount.accountId) : '';

  // Invariant: a product tab's `id` is the product `baseName`, so it lines up with
  // `persistedIds` — letting us run a worker for browsed-but-not-persisted products
  // without double-mounting one already covered by `products` above.
  const persistedIds = useMemo(() => new Set(products.map(product => product.baseName)), [products]);
  const openBrowsedProductIds = useMemo(() => {
    const ids: string[] = [];
    for (const tab of tabs) {
      const productId = resolveTabProductIdTransformer(tab);
      if (productId && !persistedIds.has(productId)) ids.push(productId);
    }
    return ids;
  }, [tabs, persistedIds]);

  return (
    <>
      {products.map(product => (
        <ProductWorker key={`${product.baseName}-${accountId}`} product={product} />
      ))}
      {openBrowsedProductIds.map(productId => (
        <OpenTabProductWorker key={`browsed-${productId}-${accountId}`} productId={productId} />
      ))}
    </>
  );
};
