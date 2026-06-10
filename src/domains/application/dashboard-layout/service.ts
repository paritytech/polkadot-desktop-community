import { DASHBOARD_GRID_SNAP_Y_STEP, GRID_COLS } from '@/shared/components';

import {
  ALLOWED_WIDGET_HEIGHTS,
  DEFAULT_RESIZE_HANDLES,
  FAVORITES_FOLDER_ID,
  FOLDER_MIN_HEIGHT,
  MAX_GRID_ROWS,
  MAX_WIDGET_HEIGHT,
  MAX_WIDGET_WIDTH,
} from './constants';
import { type DashboardCard, type FolderCardPayload } from './types';

type LayoutRect = { i: string; x: number; y: number; w: number; h: number };

function asFolder(card: DashboardCard): FolderCardPayload | null {
  if (card.payload.kind !== 'folder') return null;
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return card.payload as FolderCardPayload;
}

function isFolderCard(card: DashboardCard): boolean {
  return card.payload.kind === 'folder';
}

function isProductWidgetCard(card: DashboardCard): boolean {
  return card.payload.kind === 'product:widget';
}

function hasProductWidgetOnPages(pages: DashboardCard[][], productId: string): boolean {
  return pages.some(page => page.some(item => item.i === productId && isProductWidgetCard(item)));
}

// Locates the product's widget card across pages, returning its size and page.
function findWidgetPlacement(pages: DashboardCard[][], productId: string): { w: number; h: number; pageIndex: number } | null {
  for (const [pageIndex, page] of pages.entries()) {
    const item = page.find(card => card.i === productId && isProductWidgetCard(card));
    if (item) return { w: item.w, h: item.h, pageIndex };
  }
  return null;
}

// Locates a product inside a user (non-favorites) folder, returning the
// folder card's size and page. Favorites membership is intentionally ignored:
// a favorite can still be added as a standalone widget. Internal helper for
// `findProductDashboardPlacement` — not part of the public service surface.
function findProductFolderPlacement(
  pages: DashboardCard[][],
  productId: string,
): { w: number; h: number; pageIndex: number } | null {
  for (const [pageIndex, page] of pages.entries()) {
    for (const card of page) {
      if (card.i === FAVORITES_FOLDER_ID) continue;
      const folder = asFolder(card);
      if (folder?.items.includes(productId)) return { w: card.w, h: card.h, pageIndex };
    }
  }
  return null;
}

// Where a product currently lives on the dashboard for the add-widget modal:
// an existing top-level widget, or the user folder that already contains it.
// Used to gate the "Add" action so a product inside a folder can't also be
// added as a duplicate top-level widget.
function findProductDashboardPlacement(
  pages: DashboardCard[][],
  productId: string,
): { w: number; h: number; pageIndex: number } | null {
  return findWidgetPlacement(pages, productId) ?? findProductFolderPlacement(pages, productId);
}

// Removes legacy top-level cards that share `cardId` but are neither folders nor widgets.
function stripLegacyTopLevelCardFromPages(pages: DashboardCard[][], cardId: string): DashboardCard[][] {
  let changed = false;
  const next = pages.map(page => {
    const filtered = page.filter(item => item.i !== cardId || isFolderCard(item) || isProductWidgetCard(item));
    if (filtered.length !== page.length) {
      changed = true;
      return filtered;
    }
    return page;
  });
  return changed ? next : pages;
}

function snapLayoutY(y: number, h: number, maxRows: number, step: number = DASHBOARD_GRID_SNAP_Y_STEP): number {
  const maxY = maxRows - h;
  const snapped = Math.round(y / step) * step;
  return Math.max(0, Math.min(snapped, maxY));
}

function snapHeightToAllowed(height: number, allowedHeights: number[] = ALLOWED_WIDGET_HEIGHTS): number {
  return allowedHeights.reduce((prev, curr) => (Math.abs(curr - height) < Math.abs(prev - height) ? curr : prev));
}

function gridRectsOverlap(ax: number, ay: number, aw: number, ah: number, b: LayoutRect): boolean {
  return ax + aw > b.x && b.x + b.w > ax && ay + ah > b.y && b.y + b.h > ay;
}

// Row-major: scans left-to-right then top-to-bottom.
function findFirstFit(
  items: readonly LayoutRect[],
  w: number,
  h: number,
  gridCols = GRID_COLS,
  maxRows = MAX_GRID_ROWS,
): { x: number; y: number } | null {
  if (w < 1 || h < 1 || w > gridCols || h > maxRows) return null;

  for (let y = 0; y <= maxRows - h; y += DASHBOARD_GRID_SNAP_Y_STEP) {
    for (let x = 0; x <= gridCols - w; x++) {
      if (!items.some(item => gridRectsOverlap(x, y, w, h, item))) return { x, y };
    }
  }
  return null;
}

// Column-major: fills a column top-to-bottom before moving right.
function findColumnFit(
  items: readonly DashboardCard[],
  w: number,
  h: number,
  cols: number = GRID_COLS,
  maxRows: number = MAX_GRID_ROWS,
): { x: number; y: number } | null {
  if (w < 1 || h < 1 || w > cols || h > maxRows) return null;

  for (let x = 0; x <= cols - w; x++) {
    for (let y = 0; y <= maxRows - h; y += DASHBOARD_GRID_SNAP_Y_STEP) {
      if (!items.some(item => gridRectsOverlap(x, y, w, h, item))) return { x, y };
    }
  }
  return null;
}

// A saved dashboard exists when it has at least one page. Single source of truth
// for "is there a dashboard?", shared by the read hook (load vs empty) and the
// first-run seed (seed vs skip) so the two decisions can never drift apart.
function hasPages(pages: DashboardCard[][] | null | undefined): boolean {
  return (pages?.length ?? 0) > 0;
}

function ensurePages(pages: DashboardCard[][] | null): DashboardCard[][] {
  return pages && hasPages(pages) ? pages : [[]];
}

function findFavoritesFolder(pages: DashboardCard[][]): { pageIndex: number; item: DashboardCard } | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex] ?? [];
    const item = page.find(entry => isFolderCard(entry) && entry.i === FAVORITES_FOLDER_ID);
    if (item) return { pageIndex, item };
  }
  return null;
}

// Base names of the products currently living in the Favorites folder. The
// folder's `items` are the single source of truth for "is this a favorite",
// so reads across the app derive membership from here rather than tracking it
// separately.
function favoriteProductIds(pages: DashboardCard[][]): Set<string> {
  const found = findFavoritesFolder(pages);
  if (!found) return new Set();
  const folder = asFolder(found.item);
  if (!folder) return new Set();
  return new Set(folder.items);
}

function placeOnPages(
  pages: DashboardCard[][],
  card: DashboardCard,
  preferredPageIndex: number,
): { pages: DashboardCard[][]; pageIndex: number } {
  const searchOrder: number[] = [];
  const preferred = Math.max(0, Math.min(preferredPageIndex, pages.length - 1));
  if (pages.length > 0) {
    searchOrder.push(preferred);
    for (let i = 0; i < pages.length; i++) {
      if (i !== preferred) searchOrder.push(i);
    }
  }

  for (const index of searchOrder) {
    const position = findFirstFit(pages[index] ?? [], card.w, card.h);
    if (position) {
      const placed: DashboardCard = { ...card, x: position.x, y: position.y };
      const nextPages = pages.map((page, i) => (i === index ? [...page, placed] : page));
      return { pages: nextPages, pageIndex: index };
    }
  }

  const placed: DashboardCard = { ...card, x: 0, y: 0 };
  return { pages: [...pages, [placed]], pageIndex: pages.length };
}

function reflowFromPage(pages: DashboardCard[][], pageIndex: number, fixedItem: DashboardCard): DashboardCard[][] {
  const result: DashboardCard[][] = pages.slice(0, pageIndex);

  const sourcePage = pages[pageIndex] ?? [];

  const overlapsFixed = (item: DashboardCard) =>
    item.x < fixedItem.x + fixedItem.w &&
    fixedItem.x < item.x + item.w &&
    item.y < fixedItem.y + fixedItem.h &&
    fixedItem.y < item.y + item.h;

  const isBeforeFixed = (item: DashboardCard) =>
    (item.x < fixedItem.x || (item.x === fixedItem.x && item.y < fixedItem.y)) && !overlapsFixed(item);

  const left: DashboardCard[] = [];
  const right: DashboardCard[] = [];
  for (const item of sourcePage) {
    if (item.i === fixedItem.i) continue;
    if (isBeforeFixed(item)) left.push(item);
    else right.push(item);
  }

  right.sort((a, b) => a.x - b.x || a.y - b.y);

  const targetPage: DashboardCard[] = [...left, fixedItem];
  let carry: DashboardCard[] = [];

  for (const item of right) {
    const position = findColumnFit(targetPage, item.w, item.h, GRID_COLS, MAX_GRID_ROWS);
    if (position) {
      targetPage.push({ ...item, x: position.x, y: position.y });
    } else {
      carry.push(item);
    }
  }

  result.push(targetPage);

  for (let i = pageIndex + 1; i < pages.length; i++) {
    const originalItems = (pages[i] ?? []).slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const combined = [...carry, ...originalItems];

    const pageBuffer: DashboardCard[] = [];
    const nextCarry: DashboardCard[] = [];

    for (const item of combined) {
      const position = findColumnFit(pageBuffer, item.w, item.h, GRID_COLS, MAX_GRID_ROWS);
      if (position) {
        pageBuffer.push({ ...item, x: position.x, y: position.y });
      } else {
        nextCarry.push(item);
      }
    }

    result.push(pageBuffer);
    carry = nextCarry;
  }

  while (carry.length > 0) {
    const pageBuffer: DashboardCard[] = [];
    const nextCarry: DashboardCard[] = [];

    for (const item of carry) {
      const position = findColumnFit(pageBuffer, item.w, item.h, GRID_COLS, MAX_GRID_ROWS);
      if (position) {
        pageBuffer.push({ ...item, x: position.x, y: position.y });
      } else {
        nextCarry.push(item);
      }
    }

    if (pageBuffer.length === 0) break;

    result.push(pageBuffer);
    carry = nextCarry;
  }

  return result;
}

function compactAcrossPages(
  items: DashboardCard[],
  cols: number = GRID_COLS,
  maxRows: number = MAX_GRID_ROWS,
): DashboardCard[][] {
  if (items.length === 0) return [[]];

  const pages: DashboardCard[][] = [];
  let currentPage: DashboardCard[] = [];
  let columnHeights: number[] = new Array(cols).fill(0);

  const commitPage = () => {
    pages.push(currentPage);
    currentPage = [];
    columnHeights = new Array(cols).fill(0);
  };

  for (const item of items) {
    const width = Math.max(1, Math.min(item.w, cols));
    const height = Math.max(1, Math.min(item.h, maxRows));

    let bestX = -1;
    let bestBaseY = -1;

    for (let x = 0; x <= cols - width; x++) {
      let baseY = 0;
      for (let col = x; col < x + width; col++) {
        const colHeight = columnHeights[col] ?? 0;
        if (colHeight > baseY) baseY = colHeight;
      }
      if (baseY + height > maxRows) continue;

      if (baseY > bestBaseY || (baseY === bestBaseY && bestX === -1)) {
        bestBaseY = baseY;
        bestX = x;
      }
    }

    if (bestX === -1) {
      commitPage();
      bestX = 0;
      bestBaseY = 0;
    }

    currentPage.push({ ...item, x: bestX, y: bestBaseY, w: width, h: height });
    for (let col = bestX; col < bestX + width; col++) {
      columnHeights[col] = bestBaseY + height;
    }
  }

  if (currentPage.length > 0) pages.push(currentPage);
  if (pages.length === 0) pages.push([]);

  return pages;
}

// Defends against stale data from older app versions or invalid persisted state.
function clampCard(card: DashboardCard): DashboardCard {
  const minW = card.minW ?? 1;
  const maxW = Math.min(card.maxW ?? MAX_WIDGET_WIDTH, MAX_WIDGET_WIDTH);
  const w = Math.max(minW, Math.min(card.w, maxW));

  const minH = card.minH ?? 1;
  const maxH = Math.min(card.maxH ?? MAX_WIDGET_HEIGHT, MAX_WIDGET_HEIGHT, MAX_GRID_ROWS);
  const h = Math.max(minH, Math.min(card.h, maxH));

  const x = Math.max(0, Math.min(card.x, GRID_COLS - w));
  const y = snapLayoutY(card.y, h, MAX_GRID_ROWS);

  if (card.x === x && card.y === y && card.w === w && card.h === h) return card;
  return { ...card, x, y, w, h };
}

// RGL strips payload + min/max metadata; merge them back from `existing`.
function preserveCardMetadata(
  layoutItem: {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    maxW?: number;
    minH?: number;
    maxH?: number;
  },
  existing?: DashboardCard,
): DashboardCard {
  const minW = layoutItem.minW ?? existing?.minW ?? 1;
  const maxWBase = layoutItem.maxW ?? existing?.maxW ?? MAX_WIDGET_WIDTH;
  const maxW = Math.max(maxWBase, layoutItem.w, minW);
  const minH = layoutItem.minH ?? existing?.minH ?? 4;
  const maxH = layoutItem.maxH ?? existing?.maxH ?? MAX_WIDGET_HEIGHT;

  return {
    i: layoutItem.i,
    x: layoutItem.x,
    y: layoutItem.y,
    w: layoutItem.w,
    h: layoutItem.h,
    resizeHandles: existing?.resizeHandles || [...DEFAULT_RESIZE_HANDLES],
    minW,
    maxW,
    minH,
    maxH,
    // `existing` is always set in practice; the synthesized payload only keeps the type total.
    payload: existing?.payload ?? { kind: 'product:widget', productId: layoutItem.i },
  };
}

function cardsHaveSamePlacement(a: DashboardCard[], b: DashboardCard[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) => {
    const other = b[i];
    return other !== undefined && item.x === other.x && item.y === other.y && item.w === other.w && item.h === other.h;
  });
}

function pagesHaveSamePlacement(a: DashboardCard[][], b: DashboardCard[][]): boolean {
  if (a.length !== b.length) return false;
  return a.every((page, index) => {
    const other = b[index];
    return other !== undefined && cardsHaveSamePlacement(page, other);
  });
}

function normalizeFavoritesFolder(pagesInput: DashboardCard[][]): DashboardCard[][] {
  let firstFolderFound = false;
  let changed = false;
  const mergedIconIds: string[] = [];
  const seen = new Set<string>();

  for (const page of pagesInput) {
    for (const item of page) {
      const folder = asFolder(item);
      if (!folder) continue;
      for (const iconId of folder.items) {
        if (seen.has(iconId)) continue;
        seen.add(iconId);
        mergedIconIds.push(iconId);
      }
    }
  }

  const nextPages = pagesInput.map(page =>
    page.flatMap(item => {
      const folder = asFolder(item);
      if (!folder) return [item];

      if (!firstFolderFound) {
        firstFolderFound = true;
        const needsRename = item.i !== FAVORITES_FOLDER_ID;
        const needsMerge = folder.items.length !== mergedIconIds.length;
        const nextMinH = FOLDER_MIN_HEIGHT;
        const nextH = Math.max(item.h, nextMinH);
        const needsHeightFix = item.h !== nextH || (item.minH ?? 1) !== nextMinH || item.maxW !== 1;
        if (needsRename || needsMerge || needsHeightFix) changed = true;
        const merged: DashboardCard = {
          ...item,
          i: FAVORITES_FOLDER_ID,
          h: nextH,
          minH: nextMinH,
          maxW: 1,
          payload: { ...folder, items: mergedIconIds },
        };
        return [merged];
      }

      changed = true;
      return [];
    }),
  );

  return changed ? nextPages : pagesInput;
}

// Removes `cardId` both as a top-level card and from any folder it sits in.
// Returns the input reference when nothing changed.
function stripCardFromPages(pages: DashboardCard[][], cardId: string): DashboardCard[][] {
  let changed = false;
  const next = pages.map(page => {
    let pageChanged = false;
    const filtered: DashboardCard[] = [];
    for (const item of page) {
      if (item.i === cardId) {
        pageChanged = true;
        continue;
      }
      const folder = asFolder(item);
      if (folder?.items.includes(cardId)) {
        pageChanged = true;
        const positions = { ...folder.positions };
        delete positions[cardId];
        filtered.push({
          ...item,
          payload: { ...folder, items: folder.items.filter(id => id !== cardId), positions },
        });
      } else {
        filtered.push(item);
      }
    }
    if (pageChanged) changed = true;
    return pageChanged ? filtered : page;
  });
  return changed ? next : pages;
}

function applyCardResize(
  pages: DashboardCard[][],
  cardId: string,
  size: { w: number; h: number },
  options: { restrictToPageIndex?: number } = {},
): { pages: DashboardCard[][]; pageIndex: number; changed: boolean } | null {
  let pageIndex = -1;
  let current: DashboardCard | undefined;

  if (options.restrictToPageIndex !== undefined) {
    const page = pages[options.restrictToPageIndex] ?? [];
    const found = page.find(it => it.i === cardId);
    if (found) {
      pageIndex = options.restrictToPageIndex;
      current = found;
    }
  } else {
    for (let pi = 0; pi < pages.length; pi++) {
      const found = pages[pi]?.find(it => it.i === cardId);
      if (found) {
        pageIndex = pi;
        current = found;
        break;
      }
    }
  }

  if (!current || pageIndex < 0) return null;

  const minW = current.minW ?? 1;
  const maxW = Math.min(current.maxW ?? MAX_WIDGET_WIDTH, MAX_WIDGET_WIDTH);
  const nextW = Math.max(minW, Math.min(size.w, maxW));
  const maxH = Math.min(current.maxH ?? MAX_WIDGET_HEIGHT, MAX_WIDGET_HEIGHT, MAX_GRID_ROWS);
  const nextH = Math.max(1, Math.min(size.h, maxH));
  const nextX = Math.max(0, Math.min(current.x, GRID_COLS - nextW));
  const nextY = snapLayoutY(current.y, nextH, MAX_GRID_ROWS);

  if (current.w === nextW && current.h === nextH && current.x === nextX && current.y === nextY) {
    return { pages, pageIndex, changed: false };
  }

  const fixedItem: DashboardCard = {
    ...current,
    x: nextX,
    y: nextY,
    w: nextW,
    h: nextH,
    minH: nextH <= 1 ? 1 : Math.min(current.minH ?? nextH, nextH),
    maxW: Math.max(current.maxW ?? MAX_WIDGET_WIDTH, nextW),
  };

  const isShrinkOrSame = nextW <= current.w && nextH <= current.h;

  const nextPages = isShrinkOrSame
    ? pages.map((page, i) => (i === pageIndex ? page.map(it => (it.i === cardId ? fixedItem : it)) : page))
    : reflowFromPage(pages, pageIndex, fixedItem);

  return { pages: nextPages, pageIndex, changed: true };
}

// Removes a card by id from whichever page holds it, collapsing an emptied
// non-first page (page 0 is always kept) and shifting the active index to match.
// Pure counterpart to `applyCardResize` — the use case fetches, calls this, saves.
function removeCardFromPages(
  pages: DashboardCard[][],
  activePageIndex: number,
  cardId: string,
): { pages: DashboardCard[][]; activePageIndex: number; changed: boolean } {
  const pageIndex = pages.findIndex(page => page.some(item => item.i === cardId));
  if (pageIndex < 0) return { pages, activePageIndex, changed: false };

  const remaining = (pages[pageIndex] ?? []).filter(item => item.i !== cardId);
  const collapsePage = remaining.length === 0 && pageIndex !== 0 && pages.length > 1;

  const nextPages = collapsePage
    ? pages.filter((_, index) => index !== pageIndex)
    : pages.map((page, index) => (index === pageIndex ? remaining : page));

  // `collapsePage` guarantees `pageIndex >= 1`, so `activePageIndex - 1 >= 0`.
  const nextActiveIndex = collapsePage && activePageIndex >= pageIndex ? activePageIndex - 1 : activePageIndex;

  return { pages: nextPages, activePageIndex: nextActiveIndex, changed: true };
}

export const dashboardLayoutService = {
  asFolder,
  isFolderCard,
  isProductWidgetCard,
  hasProductWidgetOnPages,
  findWidgetPlacement,
  findProductDashboardPlacement,
  stripLegacyTopLevelCardFromPages,
  snapLayoutY,
  snapHeightToAllowed,
  findFirstFit,
  findColumnFit,
  hasPages,
  ensurePages,
  findFavoritesFolder,
  favoriteProductIds,
  placeOnPages,
  reflowFromPage,
  compactAcrossPages,
  clampCard,
  preserveCardMetadata,
  cardsHaveSamePlacement,
  pagesHaveSamePlacement,
  normalizeFavoritesFolder,
  stripCardFromPages,
  applyCardResize,
  removeCardFromPages,
};
