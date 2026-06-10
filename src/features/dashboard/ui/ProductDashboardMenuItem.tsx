import { productService, useDisplayedProduct } from '@/domains/product';

import { AddToDashboardMenuItem } from './AddToDashboardMenuItem';
import { AddToFavoritesMenuItem } from './AddToFavoritesMenuItem';

type Props = {
  productId: string;
  closeMenu: VoidFunction;
};

// Picks the dashboard-related menu item by manifest shape: products that define
// a widget executable can be placed on the dashboard ("Add to Dashboard"),
// while widget-less products are pinned to Favorites instead.
export const ProductDashboardMenuItem = ({ productId, closeMenu }: Props) => {
  const { data: product } = useDisplayedProduct(productId);

  if (!product) return null;

  if (productService.hasWidget(product)) {
    return <AddToDashboardMenuItem productId={productId} closeMenu={closeMenu} />;
  }

  return <AddToFavoritesMenuItem product={product} closeMenu={closeMenu} />;
};
