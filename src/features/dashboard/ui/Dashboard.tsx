import 'react-resizable/css/styles.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DashboardGrid } from '@/shared/components';
import { useTransformer } from '@/shared/di';
import { type DashboardCard, cardsUseCase, useDashboardLayouts, useFavoriteProductIds } from '@/domains/application';
import { useAddProductToDashboard } from '@/aggregates/product-management';
import { DEFAULT_MARGIN, DEFAULT_ROW_HEIGHT } from '../constants';
import { dashboardCardContentTransformer } from '../di';
import { type AddableDashboardCard } from '../di';
import { type CardRenderProps } from '../types';

import { AddWidgetModalDb } from './AddWidgetModalDb';
import { type DashboardPagerHandle, DashboardPager } from './DashboardPager';
import { DashboardToolbar } from './DashboardToolbar';
import { EmptyDashboardView } from './EmptyDashboardView';
import { buildNativeDashboardCard } from './add-widget/addWidgetList';

import { PageLoadingState } from '@/PageLoadingState';

type DashboardProps = {
  initialPageIndex?: number;
  onInitialPageIndexApplied?: () => void;
};

export const Dashboard = ({ initialPageIndex, onInitialPageIndexApplied }: DashboardProps = {}) => {
  const pagerRef = useRef<DashboardPagerHandle>(null);
  const dragStartVisiblePageRef = useRef(0);
  const provisionalScrollQueuedRef = useRef(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [provisionalTrailingPage, setProvisionalTrailingPage] = useState(false);
  const [visiblePageIndex, setVisiblePageIndex] = useState(0);

  const {
    pages,
    activePageIndex,
    setActivePageIndex,
    isLoading,
    handleLayoutChange,
    handleAutolayout,
    removeWidget,
    resizeWidget,
    removeFolder,
    moveItemToPrevPage,
    moveItemToNextPage,
    moveItemByPageDelta,
  } = useDashboardLayouts();

  const isEmptyDashboard = useMemo(() => {
    return pages.every(page => page.length === 0);
  }, [pages]);

  const { data: favoriteProductIds } = useFavoriteProductIds();
  const addProductToDashboard = useAddProductToDashboard();

  const handleAddNativeCard = useCallback(async (entry: AddableDashboardCard, size: { w: number; h: number }) => {
    const card = buildNativeDashboardCard(entry, size);
    return cardsUseCase.addCardToLayout(card);
  }, []);

  const itemTypeMapsPerPage = useMemo(() => {
    return pages.map(page => {
      const map = new Map<string, 'widget' | 'folder'>();
      for (const card of page) {
        map.set(card.i, card.payload.kind === 'folder' ? 'folder' : 'widget');
      }
      return map;
    });
  }, [pages]);

  const effectivePageCount = pages.length + (provisionalTrailingPage ? 1 : 0);

  useEffect(() => {
    setVisiblePageIndex(activePageIndex);
  }, [activePageIndex]);

  const handleVisiblePageIndexChange = useCallback((index: number) => {
    setVisiblePageIndex(index);
  }, []);

  useEffect(() => {
    if (!provisionalTrailingPage || !provisionalScrollQueuedRef.current) return;
    provisionalScrollQueuedRef.current = false;
    pagerRef.current?.scrollToPage(pages.length, 'smooth');
  }, [provisionalTrailingPage, pages.length]);

  const handleCrossPageDragSessionStart = useCallback(() => {
    dragStartVisiblePageRef.current = pagerRef.current?.getVisiblePageIndex() ?? activePageIndex;
  }, [activePageIndex]);

  const handleCrossPageDragSessionEnd = useCallback(() => {
    setProvisionalTrailingPage(false);
  }, []);

  // After removing the provisional "next space" slide, scroll index can point past the last real page.
  useEffect(() => {
    if (provisionalTrailingPage) return;
    const pager = pagerRef.current;
    if (!pager) return;
    const visible = pager.getVisiblePageIndex();
    const maxIndex = Math.max(0, pages.length - 1);
    if (visible > maxIndex) {
      setActivePageIndex(maxIndex);
    }
  }, [provisionalTrailingPage, pages.length, setActivePageIndex]);

  const handleDwellNavigate = useCallback(
    (direction: -1 | 1) => {
      if (direction === 1) {
        if (activePageIndex < pages.length - 1) {
          pagerRef.current?.scrollToPage(activePageIndex + 1, 'smooth');
          return;
        }
        if (activePageIndex === pages.length - 1) {
          provisionalScrollQueuedRef.current = true;
          setProvisionalTrailingPage(true);
          return;
        }
        return;
      }
      if (provisionalTrailingPage && activePageIndex === pages.length) {
        setProvisionalTrailingPage(false);
        pagerRef.current?.scrollToPage(pages.length - 1, 'smooth');
        return;
      }
      if (activePageIndex > 0) {
        pagerRef.current?.scrollToPage(activePageIndex - 1, 'smooth');
      }
    },
    [activePageIndex, pages.length, provisionalTrailingPage],
  );

  const canDwellNavigate = useCallback(
    (direction: -1 | 1) => {
      const maxIndex = effectivePageCount - 1;
      if (direction === -1) {
        return activePageIndex > 0;
      }
      return activePageIndex < maxIndex;
    },
    [activePageIndex, effectivePageCount],
  );

  const resolveScrollCrossPageDrop = useCallback(
    (itemId: string) => {
      const visible = pagerRef.current?.getVisiblePageIndex() ?? activePageIndex;
      const delta = visible - dragStartVisiblePageRef.current;
      if (delta === 0) return false;
      setProvisionalTrailingPage(false);
      moveItemByPageDelta(itemId, delta);
      return true;
    },
    [activePageIndex, moveItemByPageDelta],
  );

  const openAddModal = useCallback(() => {
    setIsAddModalOpen(true);
  }, []);

  const closeAddModal = useCallback(() => {
    setIsAddModalOpen(false);
  }, []);

  const handleNavigateToDashboardPage = useCallback(
    (pageIndex: number) => {
      setActivePageIndex(pageIndex);
      closeAddModal();
    },
    [closeAddModal, setActivePageIndex],
  );

  useEffect(() => {
    if (initialPageIndex === undefined) return;
    if (isLoading) return;

    const maxIndex = Math.max(0, pages.length - 1);
    setActivePageIndex(Math.min(initialPageIndex, maxIndex));
    onInitialPageIndexApplied?.();
  }, [initialPageIndex, isLoading, onInitialPageIndexApplied, pages.length, setActivePageIndex]);

  const handleMenuOpenChange = useCallback((menuId: string, open: boolean) => {
    setOpenMenuId(prevOpenMenuId => {
      if (open) {
        return menuId;
      }

      if (prevOpenMenuId === menuId) {
        return null;
      }

      return prevOpenMenuId;
    });
  }, []);

  const renderLayoutItem = useCallback(
    (isActivePage: boolean) => (card: DashboardCard) => {
      const menuId = `card:${card.i}`;
      // Folder cards remove themselves via `removeFolder` (which keeps the
      // page open even when emptied), every other card kind uses the standard
      // `removeWidget` path. The dashboard owns this distinction because the
      // service layer separates them — the renderer doesn't need to know
      // anything else about payload kinds.
      const onRemove = card.payload.kind === 'folder' ? () => removeFolder(card.i) : () => removeWidget(card.i);

      return (
        <div key={card.i} className="h-full">
          <CardRenderer
            card={card}
            menuId={menuId}
            isMenuOpen={openMenuId === menuId}
            isActivePage={isActivePage}
            width={card.w}
            height={card.h}
            onMenuOpenChange={handleMenuOpenChange}
            onResizeCard={size => isActivePage && resizeWidget(card.i, size)}
            onRemoveCard={() => isActivePage && onRemove()}
            onCleanupCards={handleAutolayout}
          />
        </div>
      );
    },
    [removeWidget, resizeWidget, handleAutolayout, removeFolder, openMenuId, handleMenuOpenChange],
  );

  const renderPage = useCallback(
    (pageIndex: number) => {
      const pageLayout = pageIndex < pages.length ? (pages[pageIndex] ?? []) : [];
      const itemTypeMap = itemTypeMapsPerPage[pageIndex] ?? new Map<string, 'widget' | 'folder'>();
      const isActivePage = pageIndex === activePageIndex;

      return (
        <DashboardGrid
          layout={pageLayout}
          rowHeight={DEFAULT_ROW_HEIGHT}
          margin={DEFAULT_MARGIN}
          getItemType={id => itemTypeMap.get(id)}
          canMoveToAdjacentPage={direction => (direction === -1 ? pageIndex > 0 : true)}
          crossPageEdgeDwell={
            isActivePage
              ? {
                  canDwellNavigate,
                  onDwellNavigate: handleDwellNavigate,
                  onDragSessionStart: handleCrossPageDragSessionStart,
                  onDragSessionEnd: handleCrossPageDragSessionEnd,
                }
              : undefined
          }
          onResolveScrollCrossPageDrop={isActivePage ? resolveScrollCrossPageDrop : undefined}
          onMoveToAdjacentPage={(itemId, direction) => {
            if (!isActivePage) return;
            if (direction === -1) {
              moveItemToPrevPage(itemId);
              return;
            }
            moveItemToNextPage(itemId);
          }}
          onLayoutChange={newLayout => {
            if (!isActivePage) return;
            handleLayoutChange(newLayout);
          }}
        >
          {pageLayout.map(renderLayoutItem(isActivePage))}
        </DashboardGrid>
      );
    },
    [
      pages,
      itemTypeMapsPerPage,
      activePageIndex,
      handleLayoutChange,
      renderLayoutItem,
      moveItemToPrevPage,
      moveItemToNextPage,
      canDwellNavigate,
      handleDwellNavigate,
      handleCrossPageDragSessionStart,
      handleCrossPageDragSessionEnd,
      resolveScrollCrossPageDrop,
    ],
  );

  if (isLoading) {
    return <PageLoadingState />;
  }

  if (isEmptyDashboard) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-bg-surface-main">
        <div className="min-h-0 flex-1">
          <EmptyDashboardView onAddWidget={() => openAddModal()} />
        </div>

        <DashboardToolbar
          pageCount={pages.length}
          activePageIndex={activePageIndex}
          onSelectPage={setActivePageIndex}
          onAddWidget={() => openAddModal()}
        />

        <AddWidgetModalDb
          dashboardPages={pages}
          favoriteProductIds={favoriteProductIds}
          isOpen={isAddModalOpen}
          onClose={closeAddModal}
          onNavigateToDashboardPage={handleNavigateToDashboardPage}
          onSelectProduct={addProductToDashboard}
          onAddNativeCard={handleAddNativeCard}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-surface-main">
      <div className="flex min-h-0 flex-1 flex-col">
        <DashboardPager
          ref={pagerRef}
          pageCount={effectivePageCount}
          activePageIndex={activePageIndex}
          renderPage={renderPage}
          onActivePageIndexChange={setActivePageIndex}
          onVisiblePageIndexChange={handleVisiblePageIndexChange}
        />
      </div>

      <DashboardToolbar
        pageCount={pages.length}
        activePageIndex={visiblePageIndex}
        onSelectPage={setActivePageIndex}
        onAddWidget={() => openAddModal()}
      />

      <AddWidgetModalDb
        dashboardPages={pages}
        favoriteProductIds={favoriteProductIds}
        isOpen={isAddModalOpen}
        onClose={closeAddModal}
        onNavigateToDashboardPage={handleNavigateToDashboardPage}
        onSelectProduct={addProductToDashboard}
        onAddNativeCard={handleAddNativeCard}
      />
    </div>
  );
};

// Dispatches a card to its registered content handler via the transformer.
// Returns `null` when no handler matches (unknown payload.kind).
const CardRenderer = (props: CardRenderProps) => {
  const node = useTransformer(dashboardCardContentTransformer, props);
  return node ?? null;
};
