import { memo } from 'react';

import { useDisplayedProduct } from '@/domains/product';
import { ProductWorker } from '@/widgets/ProductWorker';

type Props = {
  productId: string;
};

export const OpenTabProductWorker = memo(({ productId }: Props) => {
  const { data: product } = useDisplayedProduct(productId);

  if (!product?.executables.worker) return null;

  return <ProductWorker product={product} />;
});

OpenTabProductWorker.displayName = 'OpenTabProductWorker';
