import {
  DEFAULT_DASHBOARD_PAGES,
  DEFAULT_RESIZE_HANDLES,
  MAX_WIDGET_HEIGHT,
  MAX_WIDGET_WIDTH,
} from '../dashboard-layout/constants';
import { dashboardLayoutDb } from '../dashboard-layout/repository';
import { dashboardLayoutService } from '../dashboard-layout/service';
import { type DashboardCard } from '../dashboard-layout/types';

// First-run seed: persist the default dashboard only when none exists yet.
// Returns whether it actually seeded, so a caller can pair it with companion
// first-run setup (e.g. committing the default product). Idempotent — a no-op
// once any dashboard page is present.
async function seedDefaultMainLayout(): Promise<boolean> {
  const main = await dashboardLayoutDb.getMain();
  if (main.isErr()) return false;
  if (dashboardLayoutService.hasPages(main.value?.pages)) return false;

  const saveResult = await dashboardLayoutDb.saveMainPages(DEFAULT_DASHBOARD_PAGES, 0);
  return saveResult.isOk();
}

async function addCardToLayout(card: DashboardCard): Promise<{ ok: boolean; pageIndex?: number }> {
  if (dashboardLayoutService.isProductWidgetCard(card)) {
    const payloadProductId = card.payload['productId'];
    const productId = typeof payloadProductId === 'string' ? payloadProductId : card.i;
    return addWidgetToLayout(productId, { w: card.w, h: card.h }, card.minH ?? 4);
  }

  const main = await dashboardLayoutDb.getMain();
  if (main.isErr()) return { ok: false };
  const sourcePages = dashboardLayoutService.ensurePages(main.value?.pages ?? null);

  if (sourcePages.some(page => page.some(item => item.i === card.i))) {
    return { ok: false };
  }

  const stripped = dashboardLayoutService.stripCardFromPages(sourcePages, card.i);
  const preferred = main.value?.activePageIndex ?? 0;
  const { pages: nextPages, pageIndex } = dashboardLayoutService.placeOnPages(stripped, card, preferred);
  const saveResult = await dashboardLayoutDb.saveMainPages(nextPages, pageIndex);
  return { ok: saveResult.isOk(), pageIndex: saveResult.isOk() ? pageIndex : undefined };
}

async function removeCardFromLayout(cardId: string): Promise<boolean> {
  const main = await dashboardLayoutDb.getMain();
  if (main.isErr() || !main.value) return false;

  const next = dashboardLayoutService.removeCardFromPages(main.value.pages, main.value.activePageIndex, cardId);
  if (!next.changed) return false;

  const saveResult = await dashboardLayoutDb.saveMainPages(next.pages, next.activePageIndex);
  return saveResult.isOk();
}

async function addWidgetToLayout(
  productId: string,
  size: { w: number; h: number },
  minH: number,
): Promise<{ ok: boolean; pageIndex?: number }> {
  const main = await dashboardLayoutDb.getMain();
  if (main.isErr()) return { ok: false };
  const sourcePages = dashboardLayoutService.ensurePages(main.value?.pages ?? null);

  if (dashboardLayoutService.hasProductWidgetOnPages(sourcePages, productId)) {
    return { ok: false };
  }

  const card: DashboardCard = {
    i: productId,
    x: 0,
    y: 0,
    w: size.w,
    h: size.h,
    minW: 1,
    maxW: MAX_WIDGET_WIDTH,
    minH,
    maxH: MAX_WIDGET_HEIGHT,
    resizeHandles: [...DEFAULT_RESIZE_HANDLES],
    payload: { kind: 'product:widget', productId },
  };

  const stripped = dashboardLayoutService.stripLegacyTopLevelCardFromPages(sourcePages, productId);
  const preferred = main.value?.activePageIndex ?? 0;
  const { pages: nextPages, pageIndex } = dashboardLayoutService.placeOnPages(stripped, card, preferred);
  const saveResult = await dashboardLayoutDb.saveMainPages(nextPages, pageIndex);
  return { ok: saveResult.isOk(), pageIndex: saveResult.isOk() ? pageIndex : undefined };
}

async function resizeCardToGridSize(
  cardId: string,
  size: { w: number; h: number },
): Promise<{ ok: boolean; pageIndex?: number }> {
  const result = await dashboardLayoutDb.getMainPages();
  if (result.isErr() || !result.value) return { ok: false };

  const applied = dashboardLayoutService.applyCardResize(result.value, cardId, size);
  if (!applied) return { ok: false };
  if (!applied.changed) return { ok: true, pageIndex: applied.pageIndex };

  const saveResult = await dashboardLayoutDb.saveMainPages(applied.pages, applied.pageIndex);
  return { ok: saveResult.isOk(), pageIndex: saveResult.isOk() ? applied.pageIndex : undefined };
}

export const cardsUseCase = {
  addCardToLayout,
  removeCardFromLayout,
  addWidgetToLayout,
  resizeCardToGridSize,
  seedDefaultMainLayout,
};
