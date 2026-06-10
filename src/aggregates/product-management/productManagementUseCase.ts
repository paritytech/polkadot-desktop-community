import { DEFAULT_DASHBOARD_WIDGET_PRODUCT_ID, cardsUseCase, foldersUseCase } from '@/domains/application';
import { type Product, commitmentUseCase, lifecycleUseCase } from '@/domains/product';

const WIDGET_MIN_HEIGHT = 4;

// A 1×1 placement is a favorites-folder icon; anything larger is a dashboard widget.
const isFavoriteSize = (gridSize: { w: number; h: number }) => gridSize.w === 1 && gridSize.h === 1;

// First-run initialization — a new user gets the default dashboard. Called once
// from app bootstrap, never from a view. Seeds the default layout (application);
// only when that actually seeded a fresh dashboard does it commit the default
// product (product) so the seeded widget resolves to an installed entry.
async function ensureDefaultDashboard(): Promise<void> {
  const seeded = await cardsUseCase.seedDefaultMainLayout();
  if (seeded) {
    await commitmentUseCase.commitProductByIdentifier(DEFAULT_DASHBOARD_WIDGET_PRODUCT_ID);
  }
}

// Single entry point for "add this product to the dashboard at the chosen size",
// used by every dashboard add/favorite flow. `commitResolvedProduct` is
// idempotent — it persists a transient product and no-ops an installed one — so
// we always commit first, then place (favorite for 1×1, widget otherwise),
// falling back to a resize when the widget is already on a page.
async function addProductToDashboard(
  product: Product,
  gridSize: { w: number; h: number },
): Promise<{ ok: boolean; pageIndex?: number }> {
  const saved = await commitmentUseCase.commitResolvedProduct(product);
  if (!saved) return { ok: false };

  const placed = await placeOnDashboard(saved.baseName, gridSize);
  // A favorite has no resize concept; otherwise an already-placed widget is resized.
  if (placed.ok || isFavoriteSize(gridSize)) return placed;
  return cardsUseCase.resizeCardToGridSize(saved.baseName, gridSize);
}

function placeOnDashboard(baseName: string, gridSize: { w: number; h: number }): Promise<{ ok: boolean; pageIndex?: number }> {
  if (isFavoriteSize(gridSize)) return foldersUseCase.addIconToFavorites(baseName);
  return cardsUseCase.addWidgetToLayout(baseName, gridSize, WIDGET_MIN_HEIGHT);
}

// Detach the product from the dashboard, then tear down all product-owned state.
// Favorites removal wins when the product lives in the folder; otherwise it is a
// top-level card. The product-internal purge is delegated to the product domain.
async function forgetProduct(productId: string): Promise<boolean> {
  const removedFromFolder = await foldersUseCase.removeIconFromFolder(productId);
  if (!removedFromFolder) {
    await cardsUseCase.removeCardFromLayout(productId);
  }

  return lifecycleUseCase.purgeProduct(productId);
}

export const productManagementUseCase = {
  ensureDefaultDashboard,
  addProductToDashboard,
  forgetProduct,
};
