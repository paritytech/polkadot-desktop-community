import {
  type DashboardCard,
  DEFAULT_DASHBOARD_WIDGET_PRODUCT_LABEL,
  DEFAULT_RESIZE_HANDLES,
  MAX_WIDGET_HEIGHT,
  MAX_WIDGET_WIDTH,
  cardsUseCase,
  foldersUseCase,
} from '@/domains/application';
import { type Product, commitmentUseCase, dotNsService, dotNsUseCase, lifecycleUseCase } from '@/domains/product';
import { truapiRuntimeUseCase } from '@/aggregates/truapi-runtime';

const WIDGET_MIN_HEIGHT = 4;

// Builds the product-widget card the dashboard places. The aggregate owns the
// product→card mapping (content payload + the grid bounds the dashboard domain
// no longer hardcodes); the domain treats the payload as opaque.
function buildProductWidgetCard(baseName: string, gridSize: { w: number; h: number }): DashboardCard {
  return {
    i: baseName,
    x: 0,
    y: 0,
    w: gridSize.w,
    h: gridSize.h,
    minW: 1,
    maxW: MAX_WIDGET_WIDTH,
    minH: WIDGET_MIN_HEIGHT,
    maxH: MAX_WIDGET_HEIGHT,
    resizeHandles: [...DEFAULT_RESIZE_HANDLES],
    payload: { kind: 'product:widget', productId: baseName },
  };
}

// A 1×1 placement is a favorites-folder icon; anything larger is a dashboard widget.
const isFavoriteSize = (gridSize: { w: number; h: number }) => gridSize.w === 1 && gridSize.h === 1;

// First-run initialization — a new user gets the default dashboard. Called once
// from app bootstrap, never from a view. Seeds the default layout (application);
// only when that actually seeded a fresh dashboard does it commit the default
// product (product) so the seeded widget resolves to an installed entry.
async function ensureDefaultDashboard(): Promise<void> {
  // The aggregate derives the full name because it may see both domains — the
  // `application` domain, which owns the layout, may not import `product`.
  const tld = await dotNsUseCase.getActiveTld();
  const defaultProductId = dotNsService.baseNameOf(DEFAULT_DASHBOARD_WIDGET_PRODUCT_LABEL, tld);

  const seeded = await cardsUseCase.seedDefaultMainLayout(defaultProductId);
  if (seeded) {
    await commitmentUseCase.commitProductByIdentifier(defaultProductId);
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
  if (isFavoriteSize(gridSize)) return foldersUseCase.addToFavorites(baseName);
  return cardsUseCase.addCardToLayout(buildProductWidgetCard(baseName, gridSize));
}

/**
 * Clear what the core holds for the product — grants, Allow once answers, keys and
 * stored values — under every id it was filed under. Best-effort per id: one id the
 * core refuses must not keep the rest, or the product, alive.
 */
async function clearCoreProductState(productId: string): Promise<void> {
  const ids = await lifecycleUseCase.listCoreProductIds(productId);

  await Promise.all(
    ids.map(id =>
      truapiRuntimeUseCase.clearProductState(id).catch((error: unknown) => {
        console.warn('[product-management] the core could not clear product state', { productId: id, error });
      }),
    ),
  );
}

// Detach the product from the dashboard, then tear down all product-owned state.
// Favorites removal wins when the product lives in the folder; otherwise it is a
// top-level card. The core clears its own state; the product-internal purge is
// delegated to the product domain.
async function forgetProduct(productId: string): Promise<boolean> {
  const removedFromFolder = await foldersUseCase.removeItemFromFolder(productId);
  if (!removedFromFolder) {
    await cardsUseCase.removeCardFromLayout(productId);
  }

  await clearCoreProductState(productId);

  return lifecycleUseCase.purgeProduct(productId);
}

/** Clear Cache: the product's core state and its sandbox data. The product stays installed. */
async function clearProductData(productId: string): Promise<void> {
  await clearCoreProductState(productId);
  await lifecycleUseCase.clearProductCache(productId);
}

export const productManagementUseCase = {
  ensureDefaultDashboard,
  addProductToDashboard,
  forgetProduct,
  clearProductData,
};
