import { toastSuccess } from '@novasamatech/tr-ui';

import { foldersUseCase } from '@/domains/application';
import { productService, resolveProductUseCase } from '@/domains/product';
import { productManagementUseCase } from '@/aggregates/product-management';

import { openAddToDashboardDialog } from './state/addToDashboardDialog';

export type TranslateFn = (id: string, values?: Record<string, string | number>) => string;

// Same behavior as ProductDashboardMenuItem / Add to Dashboard or Add to Favorites.
export async function triggerProductDashboardShortcut(productId: string, t: TranslateFn): Promise<void> {
  const product = await resolveProductUseCase.resolveProduct(productId);
  if (!product) return;

  if (productService.hasWidget(product)) {
    openAddToDashboardDialog(productId);
    return;
  }

  const productName = product.displayName;
  const isFavorite = await foldersUseCase.isIconInFavorites(productId);

  if (isFavorite) {
    const removed = await foldersUseCase.removeIconFromFolder(productId);
    if (removed) {
      toastSuccess({ title: t('feature.dashboard.menu.toast.removedFromFavorites', { productName }) });
    }
    return;
  }

  const result = await productManagementUseCase.addProductToDashboard(product, { w: 1, h: 1 });
  if (result.ok) {
    toastSuccess({ title: t('feature.dashboard.menu.toast.addedToFavorites', { productName }) });
  }
}
