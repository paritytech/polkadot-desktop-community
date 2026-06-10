import { createFeature } from '@/shared/feature';
import { addressBarProductLeadingSlot } from '@/features/browser';

import { ProductActionsMenu } from './ui/ProductActionsMenu';

export const productActionsMenuFeature = createFeature({
  name: 'browser/product-actions-menu',
});

productActionsMenuFeature.inject(addressBarProductLeadingSlot, {
  order: 0,
  render: ({ product, isFocused }) =>
    product ? <ProductActionsMenu productId={product.baseName} isFocused={isFocused} /> : null,
});
