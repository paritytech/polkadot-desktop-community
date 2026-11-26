import { type DragEndEvent, DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { ArrowUpRight, MoreHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { DropdownMenu, IconButton } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { FAVORITES_GRID_COLS } from '@/domains/application';
import { type FolderItemIconSize } from '../../types';

import { FolderItemContent } from './FolderItemContent';
import { SortableFolderItem } from './SortableFolderItem';

const GRID_COLS = FAVORITES_GRID_COLS;

type FolderGridProps = {
  folderId: string;
  items: string[];
  maxVisibleItems: number;
  iconSize: FolderItemIconSize;
  hasViewMore: boolean;
  openMenuId: string | null;
  onMenuOpenChange: (menuId: string, open: boolean) => void;
  onOpenWidget: (widgetId: string) => void;
  onRemoveWidget: (widgetId: string) => void;
  onReorderItems: (orderedItemIds: string[]) => void;
  onOpenViewMore: VoidFunction;
};

type FolderGridItemProps = {
  itemId: string;
  menuId: string;
  iconSize: FolderItemIconSize;
  isMenuOpen: boolean;
  menuLabel: string;
  removeLabel: string;
  onMenuOpenChange: (menuId: string, open: boolean) => void;
  onOpenWidget: (widgetId: string) => void;
  onRemoveWidget: (widgetId: string) => void;
};

const FolderGridItem = ({
  itemId,
  menuId,
  iconSize,
  isMenuOpen,
  menuLabel,
  removeLabel,
  onMenuOpenChange,
  onOpenWidget,
  onRemoveWidget,
}: FolderGridItemProps) => {
  const handleOpenWidget = () => {
    onOpenWidget(itemId);
  };

  const handleRemoveWidget = () => {
    onRemoveWidget(itemId);
  };

  const menuVisibilityClass = isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover/folder-item:opacity-100';

  return (
    <div className="group/folder-item relative flex h-full w-full flex-col items-center justify-center rounded-xl">
      <button
        type="button"
        data-testid={TEST_IDS.dashboardFavoriteIcon}
        className="flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-xl focus-visible:ring-4 focus-visible:ring-stroke-tertiary/35 focus-visible:ring-offset-0 focus-visible:outline-none"
        onClick={handleOpenWidget}
      >
        <FolderItemContent itemId={itemId} iconSize={iconSize} />
      </button>

      <DropdownMenu.Root open={isMenuOpen} onOpenChange={open => onMenuOpenChange(menuId, open)}>
        <span className={cnTw('absolute end-1 top-1 flex transition-opacity', menuVisibilityClass)}>
          <DropdownMenu.Trigger asChild>
            <IconButton
              size="sm"
              label={menuLabel}
              onClick={event => event.stopPropagation()}
              onMouseDown={event => event.stopPropagation()}
            >
              <MoreHorizontal aria-hidden />
            </IconButton>
          </DropdownMenu.Trigger>
        </span>
        <DropdownMenu.Content align="end">
          <div className="w-52.5">
            <DropdownMenu.Item variant="danger" onClick={handleRemoveWidget}>
              <Trash2 className="size-4" />
              <span className="flex-1">{removeLabel}</span>
            </DropdownMenu.Item>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  );
};

// Trailing tile shown when favourites overflow the folder's capacity: shares the
// item cards' frame, but opens the fullscreen Favorites SPA instead of a product.
// It carries no app icon, so the arrow sits on the card surface rather than on a
// nested one. Not draggable/removable — it isn't part of the persisted items.
const FolderViewMoreTile = ({ label, onClick }: { label: string; onClick: VoidFunction }) => (
  <button
    type="button"
    data-testid={TEST_IDS.dashboardFavoritesViewMore}
    aria-label={label}
    className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border border-stroke-primary bg-bg-surface-container p-2 focus-visible:ring-4 focus-visible:ring-stroke-tertiary/35 focus-visible:ring-offset-0 focus-visible:outline-none"
    onClick={onClick}
  >
    <ArrowUpRight className="size-7 shrink-0 text-fg-primary" aria-hidden />
    <span className="max-w-full shrink-0 truncate text-xs font-semibold text-fg-primary">{label}</span>
  </button>
);

// The folder body: a fixed grid of icon cells laid out purely by `items` order —
// cell n holds item n. There is no per-item coordinate to persist, so an icon can
// only be moved relative to the other icons, never parked in an empty cell, and
// the order is the same one the Favorites SPA reads and writes. Reordering mirrors
// the SPA exactly (dnd-kit sortable + `arrayMove`).
export const FolderGrid = ({
  folderId,
  items,
  maxVisibleItems,
  iconSize,
  hasViewMore,
  openMenuId,
  onMenuOpenChange,
  onOpenWidget,
  onRemoveWidget,
  onReorderItems,
  onOpenViewMore,
}: FolderGridProps) => {
  const { t } = useTranslation();
  const suppressOpenRef = useRef(false);
  const menuLabel = t('common.action.moreDetails');
  const removeLabel = t('feature.dashboard.favorites.removeProduct');
  const viewMoreLabel = t('feature.dashboard.favorites.viewMore');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Rows are declared, not measured: the grid always spans the capped row count, so
  // every visible cell fits the card body at any widget size without scrolling.
  const maxVisibleRows = Math.ceil(maxVisibleItems / GRID_COLS);

  // Local drag order, reconciled with the live item set (keep known order, append
  // new ids, drop removed ones) — same as the Favorites SPA. Reordering persists
  // through the domain, so this only smooths the optimistic update between the drop
  // and the re-emit; without it dnd-kit releases the transform and the icon snaps
  // back to its old cell until the write round-trips.
  const [order, setOrder] = useState<string[]>(items);
  useEffect(() => {
    setOrder(prev => {
      const live = new Set(items);
      const kept = prev.filter(id => live.has(id));
      const added = items.filter(id => !prev.includes(id));
      const next = [...kept, ...added];
      return next.length === prev.length && next.every((id, index) => id === prev[index]) ? prev : next;
    });
  }, [items]);

  const handleDragStart = () => {
    suppressOpenRef.current = true;
    if (!openMenuId) return;
    onMenuOpenChange(openMenuId, false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setTimeout(() => {
      suppressOpenRef.current = false;
    }, 0);
    if (!over || active.id === over.id) return;

    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    onReorderItems(next);
  };

  const handleOpenWidget = (widgetId: string) => {
    if (suppressOpenRef.current) return;
    onOpenWidget(widgetId);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <div
          className="grid h-full w-full gap-2"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${maxVisibleRows}, minmax(0, 1fr))`,
          }}
        >
          {order.map(itemId => {
            const menuId = `favorite:${folderId}:${itemId}`;

            return (
              <SortableFolderItem key={itemId} itemId={itemId}>
                <FolderGridItem
                  itemId={itemId}
                  menuId={menuId}
                  iconSize={iconSize}
                  isMenuOpen={openMenuId === menuId}
                  menuLabel={menuLabel}
                  removeLabel={removeLabel}
                  onMenuOpenChange={onMenuOpenChange}
                  onOpenWidget={handleOpenWidget}
                  onRemoveWidget={onRemoveWidget}
                />
              </SortableFolderItem>
            );
          })}
          {hasViewMore ? <FolderViewMoreTile label={viewMoreLabel} onClick={onOpenViewMore} /> : null}
        </div>
      </SortableContext>
    </DndContext>
  );
};
