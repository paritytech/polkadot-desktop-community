import { Star } from 'lucide-react';

import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { useFavoriteProductIds } from '@/domains/application';
import { type Product } from '@/domains/product';
import { MenuItem } from '@/features/product-actions-menu';
import { triggerProductDashboardShortcut } from '../triggerProductDashboardShortcut';

type Props = {
  product: Product;
  closeMenu: VoidFunction;
};

// Favorites toggle shown for products without a widget executable, where there
// is no widget to place on the dashboard. Adding stores the product as a 1×1
// icon in the Favorites folder; the label flips to "Remove" once it is there.
//
// Adding goes through `addProductToDashboard` at size 1×1 rather than
// `addIconToFavorites` directly: the product may still be transient
// (browsed but not committed), and the folder grid renders only persisted
// products — so the icon must be committed before its id is filed into the folder.
export const AddToFavoritesMenuItem = ({ product, closeMenu }: Props) => {
  const { t } = useTranslation();
  const { data: favoriteProductIds } = useFavoriteProductIds();

  const productId = product.baseName;
  const isFavorite = favoriteProductIds.has(productId);

  return (
    <MenuItem
      icon={<Star className={cnTw('size-4', isFavorite && 'fill-current')} aria-hidden strokeWidth={1.75} />}
      label={isFavorite ? t('feature.dashboard.menu.removeFromFavorites') : t('feature.dashboard.menu.addToFavorites')}
      onSelect={async () => {
        closeMenu();
        await triggerProductDashboardShortcut(productId, t);
      }}
    />
  );
};
