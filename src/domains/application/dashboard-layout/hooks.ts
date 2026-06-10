import { useCallback, useEffect, useRef, useState } from 'react';
import { type Layout, type LayoutItem } from 'react-grid-layout';

import { layoutInteractionSession } from '@/shared/components';
import { useRead } from '@/shared/hooks';
import { cardsUseCase } from '../$usecase/cards';
import { foldersUseCase } from '../$usecase/folders';

import { DEFAULT_DASHBOARD_PAGES, FOLDER_MIN_HEIGHT, MAX_GRID_ROWS, MAX_WIDGET_WIDTH } from './constants';
import { mainDashboardLayoutResource, saveMainActivePage, saveMainLayout } from './resource';
import { dashboardLayoutService } from './service';
import { type DashboardCard } from './types';

const EMPTY_FAVORITES: ReadonlySet<string> = new Set();

// Live set of product base names in the Favorites folder. Reads the shared
// main-layout resource, so a membership check (e.g. the product actions menu)
// rides the same cached subscription as the dashboard grid rather than opening
// its own subscription to the `dashboardLayouts` table.
export const useFavoriteProductIds = () => {
  return useRead(mainDashboardLayoutResource, {
    params: {},
    defaultValue: EMPTY_FAVORITES,
    map: snapshot => dashboardLayoutService.favoriteProductIds(snapshot?.pages ?? []),
  });
};

// Imperative setter for the main dashboard's active page. Used by entry points
// (e.g. the Home button) that jump to a page without mounting the full grid, so
// they reach the layout through the domain instead of the repository.
export const useSetMainActivePage = () =>
  useCallback((index: number) => {
    void saveMainActivePage(index);
  }, []);

export function useDashboardLayouts() {
  const [pages, setPages] = useState<DashboardCard[][]>(DEFAULT_DASHBOARD_PAGES);
  const [activePageIndex, setActivePageIndexState] = useState(0);
  const activePageIndexRef = useRef(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const subscription = mainDashboardLayoutResource.read$({}).subscribe({
      next: snapshot => {
        if (snapshot && dashboardLayoutService.hasPages(snapshot.pages)) {
          if (layoutInteractionSession.drag || layoutInteractionSession.resize) {
            return;
          }

          const normalized = dashboardLayoutService.normalizeFavoritesFolder(snapshot.pages);
          let clampChanged = false;
          const clampedPages = normalized.map(page => {
            let pageChanged = false;
            const next = page.map(card => {
              const c = dashboardLayoutService.clampCard(card);
              if (c !== card) pageChanged = true;
              return c;
            });
            if (pageChanged) clampChanged = true;
            return pageChanged ? next : page;
          });
          const clamped = clampChanged ? clampedPages : normalized;
          const sanitized = clamped !== snapshot.pages;
          setPages(clamped);
          const nextActiveIndex = Math.min(snapshot.activePageIndex, clamped.length - 1);
          activePageIndexRef.current = nextActiveIndex;
          setActivePageIndexState(nextActiveIndex);
          if (sanitized) {
            saveMainLayout(clamped);
          }
          setIsLoading(false);
        } else {
          // No saved dashboard yet. Seeding is a first-run concern owned by
          // `ensureDefaultDashboard` at app bootstrap, not this view — the hook
          // just shows the default layout (its initial state) until the seed
          // write lands and re-emits through this same subscription.
          setIsLoading(false);
        }
      },
      error: err => {
        console.error('Error loading dashboard layout:', err);
        setIsLoading(false);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const savePages = useCallback(async (newPages: DashboardCard[][], activeIndex?: number) => {
    const nextActiveIndex = activeIndex ?? activePageIndexRef.current;
    await saveMainLayout(newPages, nextActiveIndex);
  }, []);

  const updatePageAndSave = useCallback(
    (pageIndex: number, newLayout: DashboardCard[]) => {
      setPages(prev => {
        const next = prev.map((page, index) => (index === pageIndex ? newLayout : page));
        savePages(next);
        return next;
      });
    },
    [savePages],
  );

  const setActivePageIndex = useCallback((index: number) => {
    setActivePageIndexState(prev => {
      if (prev === index) return prev;
      activePageIndexRef.current = index;
      saveMainActivePage(index);
      return index;
    });
  }, []);

  const activeLayout = pages[activePageIndex] ?? [];

  const handleLayoutChange = useCallback(
    (newLayout: Layout): void => {
      const processedLayout = newLayout.map((layoutItem: LayoutItem) => {
        const existing = activeLayout.find(item => item.i === layoutItem.i);
        const preserved = dashboardLayoutService.preserveCardMetadata(layoutItem, existing);

        const isFolder = preserved.payload.kind === 'folder';
        preserved.h = dashboardLayoutService.snapHeightToAllowed(layoutItem.h);
        preserved.minH = isFolder ? FOLDER_MIN_HEIGHT : Math.min(preserved.minH ?? 1, preserved.h);
        preserved.maxW = isFolder ? 1 : Math.max(preserved.maxW ?? MAX_WIDGET_WIDTH, preserved.w);
        preserved.y = dashboardLayoutService.snapLayoutY(preserved.y, preserved.h, MAX_GRID_ROWS);
        // Drag/drop must never change widget width — only resizeWidget() may do that.
        // correctBounds() in react-grid-layout can set w = cols when x < 0, corrupting layout.
        if (existing !== undefined) {
          preserved.w = existing.w;
        }

        return preserved;
      });

      const exceedsMax = processedLayout.some(item => item.y + item.h > MAX_GRID_ROWS);
      if (exceedsMax) {
        return;
      }

      updatePageAndSave(activePageIndex, processedLayout);
    },
    [activeLayout, activePageIndex, updatePageAndSave],
  );

  const handleAutolayout = useCallback(() => {
    setPages(prev => {
      const flatInReadingOrder: DashboardCard[] = [];
      for (const page of prev) {
        const sorted = [...page].sort((a, b) => a.y - b.y || a.x - b.x);
        flatInReadingOrder.push(...sorted);
      }

      if (flatInReadingOrder.length === 0) return prev;

      const compactedPages = dashboardLayoutService.compactAcrossPages(flatInReadingOrder);

      const originalsById = new Map(flatInReadingOrder.map(item => [item.i, item]));
      const nextPages = compactedPages.map(page =>
        page.map(item => {
          const original = originalsById.get(item.i);
          return original ? { ...original, x: item.x, y: item.y, w: item.w, h: item.h } : item;
        }),
      );

      const nextActive = Math.min(activePageIndex, nextPages.length - 1);
      activePageIndexRef.current = nextActive;
      setActivePageIndexState(prevActive => (prevActive === nextActive ? prevActive : nextActive));
      savePages(nextPages, nextActive);
      return nextPages;
    });
  }, [activePageIndex, savePages]);

  const addWidget = useCallback((productId: string, size: { w: number; h: number }, minH: number = 4) => {
    return cardsUseCase.addWidgetToLayout(productId, size, minH);
  }, []);

  const addIconToFavorites = useCallback((productId: string) => {
    return foldersUseCase.addIconToFavorites(productId);
  }, []);

  // Card lifecycle (remove/resize) goes through the card use cases — the single
  // write path to the `dashboardLayouts` table. The use case persists and the
  // live `mainDashboardLayoutResource` subscription re-emits the new layout, so
  // there is no separate optimistic copy to keep in sync.
  const removeWidget = useCallback((productId: string) => cardsUseCase.removeCardFromLayout(productId), []);

  const resizeWidget = useCallback(
    (widgetId: string, size: { w: number; h: number }) => cardsUseCase.resizeCardToGridSize(widgetId, size),
    [],
  );

  // A folder is a first-class card, so removing it is removing its card.
  const removeFolder = useCallback((folderId: string) => cardsUseCase.removeCardFromLayout(folderId), []);

  const applyMoveItemToAdjacentPage = useCallback((prev: DashboardCard[][], itemId: string, direction: -1 | 1) => {
    const sourcePageIndex = prev.findIndex(page => page.some(item => item.i === itemId));
    if (sourcePageIndex === -1) return null;

    const sourcePage = prev[sourcePageIndex] ?? [];
    const itemToMove = sourcePage.find(item => item.i === itemId);
    if (!itemToMove) return null;

    let targetPageIndex = sourcePageIndex + direction;
    if (targetPageIndex < 0) return null;

    const nextPages = prev.map(page => [...page]);
    while (targetPageIndex >= nextPages.length) {
      nextPages.push([]);
    }

    nextPages[sourcePageIndex] = sourcePage.filter(item => item.i !== itemId);

    if (nextPages[sourcePageIndex].length === 0 && sourcePageIndex !== 0 && nextPages.length > 1) {
      nextPages.splice(sourcePageIndex, 1);
      if (sourcePageIndex < targetPageIndex) {
        targetPageIndex -= 1;
      }
    }

    const targetPage = nextPages[targetPageIndex] ?? [];
    const targetPosition = dashboardLayoutService.findColumnFit(targetPage, itemToMove.w, itemToMove.h);

    if (targetPosition) {
      targetPage.push({ ...itemToMove, x: targetPosition.x, y: targetPosition.y });
      nextPages[targetPageIndex] = targetPage;
    } else {
      const overflowPageIndex = targetPageIndex + 1;
      while (overflowPageIndex >= nextPages.length) {
        nextPages.push([]);
      }
      nextPages[overflowPageIndex] = [{ ...itemToMove, x: 0, y: 0 }];
      targetPageIndex = overflowPageIndex;
    }

    return { nextPages, targetPageIndex };
  }, []);

  const moveItemToAdjacentPage = useCallback(
    (itemId: string, direction: -1 | 1) => {
      setPages(prev => {
        const result = applyMoveItemToAdjacentPage(prev, itemId, direction);
        if (!result) return prev;

        const { nextPages, targetPageIndex } = result;
        activePageIndexRef.current = targetPageIndex;
        setActivePageIndexState(targetPageIndex);
        savePages(nextPages, targetPageIndex);
        return nextPages;
      });
    },
    [applyMoveItemToAdjacentPage, savePages],
  );

  const moveItemByPageDelta = useCallback(
    (itemId: string, delta: number) => {
      if (delta === 0) return;

      const sign = delta > 0 ? 1 : -1;
      const steps = Math.abs(delta);

      setPages(prev => {
        let current = prev;
        let targetPageIndex = activePageIndexRef.current;
        let moved = false;

        for (let step = 0; step < steps; step++) {
          const result = applyMoveItemToAdjacentPage(current, itemId, sign);
          if (!result) break;
          current = result.nextPages;
          targetPageIndex = result.targetPageIndex;
          moved = true;
        }

        if (!moved) return prev;

        activePageIndexRef.current = targetPageIndex;
        setActivePageIndexState(targetPageIndex);
        savePages(current, targetPageIndex);
        return current;
      });
    },
    [applyMoveItemToAdjacentPage, savePages],
  );

  const moveItemToPrevPage = useCallback(
    (itemId: string) => {
      moveItemToAdjacentPage(itemId, -1);
    },
    [moveItemToAdjacentPage],
  );

  const moveItemToNextPage = useCallback(
    (itemId: string) => {
      moveItemToAdjacentPage(itemId, 1);
    },
    [moveItemToAdjacentPage],
  );

  return {
    pages,
    activePageIndex,
    setActivePageIndex,
    layout: activeLayout,
    isLoading,
    handleLayoutChange,
    handleAutolayout,
    addWidget,
    addIconToFavorites,
    removeWidget,
    resizeWidget,
    removeFolder,
    moveItemToPrevPage,
    moveItemToNextPage,
    moveItemByPageDelta,
  };
}
