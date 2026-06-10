import { AppIcon, DropdownMenu } from '@novasamatech/tr-ui';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { type Layout, type LayoutItem, ResponsiveGridLayout, noCompactor, useContainerWidth } from 'react-grid-layout';

import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type FolderItemPositions } from '@/domains/application';
import { useProductIcon } from '@/domains/product';
import { type FolderItem } from '../../types';

const GRID_COLS = 3;
const GAP = 8;
const ROW_HEIGHT = 84;
const CONTAINER_PADDING: [number, number] = [0, 0];

const createPreventCollisionCompactor = () => ({
  ...noCompactor,
  preventCollision: true,
});

const getFirstFreePosition = (usedPositions: Set<string>): { x: number; y: number } => {
  for (let y = 0; ; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      const key = `${x}:${y}`;
      if (!usedPositions.has(key)) {
        usedPositions.add(key);
        return { x, y };
      }
    }
  }
};

const toGridLayout = (items: FolderItem[], positions?: FolderItemPositions): Layout => {
  const usedPositions = new Set<string>();

  return items.map(item => {
    const savedPosition = positions?.[item.widgetId];
    const savedPositionKey = savedPosition ? `${savedPosition.x}:${savedPosition.y}` : '';
    const hasValidPosition =
      savedPosition &&
      savedPosition.x >= 0 &&
      savedPosition.x < GRID_COLS &&
      savedPosition.y >= 0 &&
      !usedPositions.has(savedPositionKey);
    const position = hasValidPosition ? savedPosition : getFirstFreePosition(usedPositions);

    usedPositions.add(`${position.x}:${position.y}`);

    return {
      i: item.widgetId,
      x: position.x,
      y: position.y,
      w: 1,
      h: 1,
      minW: 1,
      maxW: 1,
      minH: 1,
      maxH: 1,
      isResizable: false,
    };
  });
};

const layoutToPositions = (layout: Layout): FolderItemPositions => {
  return Object.fromEntries(layout.map(item => [item.i, { x: item.x, y: item.y }]));
};

type FolderGridProps = {
  folderId: string;
  items: FolderItem[];
  positions?: FolderItemPositions;
  openMenuId: string | null;
  onMenuOpenChange: (menuId: string, open: boolean) => void;
  onOpenWidget: (widgetId: string) => void;
  onRemoveWidget: (widgetId: string) => void;
  onChangeWidgetPositions: (positions: FolderItemPositions) => void;
};

type FolderGridItemProps = {
  item: FolderItem;
  menuId: string;
  isMenuOpen: boolean;
  menuLabel: string;
  removeLabel: string;
  onMenuOpenChange: (menuId: string, open: boolean) => void;
  onOpenWidget: (widgetId: string) => void;
  onRemoveWidget: (widgetId: string) => void;
};

const FolderIconContent = ({ item }: { item: FolderItem }) => {
  const { NativeIcon } = item;
  const { data: iconUrl } = useProductIcon(item.icon ?? null);

  return (
    <span className="flex w-full flex-col items-center justify-center gap-2">
      <AppIcon size="md" src={iconUrl ?? undefined} alt={item.name}>
        {NativeIcon ? <NativeIcon className="size-full" /> : null}
      </AppIcon>
      <span className="max-w-full truncate text-center text-sm leading-5 font-semibold text-text-primary">{item.name}</span>
    </span>
  );
};

const FolderGridItem = ({
  item,
  menuId,
  isMenuOpen,
  menuLabel,
  removeLabel,
  onMenuOpenChange,
  onOpenWidget,
  onRemoveWidget,
}: FolderGridItemProps) => {
  const handleOpenWidget = () => {
    onOpenWidget(item.widgetId);
  };

  const handleRemoveWidget = () => {
    onRemoveWidget(item.widgetId);
  };

  const menuVisibilityClass = isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover/folder-item:opacity-100';

  return (
    <div className="folder-grid-item group/folder-item relative flex h-full w-full flex-col items-center justify-center rounded-xl">
      <button
        type="button"
        className="folder-grid-drag-handle flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl p-2 focus-visible:ring-[4px] focus-visible:ring-border-tertiary/35 focus-visible:ring-offset-0 focus-visible:outline-none"
        aria-label={item.name}
        onClick={handleOpenWidget}
      >
        <FolderIconContent item={item} />
      </button>

      <DropdownMenu open={isMenuOpen} onOpenChange={open => onMenuOpenChange(menuId, open)}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className={cnTw(
              'folder-grid-action absolute top-1 right-1 flex size-6 cursor-pointer items-center justify-center rounded-full bg-bg-action-secondary-hover text-text-primary transition-opacity hover:brightness-95 focus-visible:ring-[4px] focus-visible:ring-border-tertiary/35 focus-visible:ring-offset-0 focus-visible:outline-none',
              menuVisibilityClass,
            )}
            aria-label={menuLabel}
            onClick={event => event.stopPropagation()}
            onMouseDown={event => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          <div className="w-[210px]">
            <DropdownMenu.Item variant="destructive" onClick={handleRemoveWidget}>
              <div className="flex h-8 w-full items-center gap-2 rounded-md">
                <Trash2 className="size-4 text-fg-error" />
                <span className="flex-1 text-sm leading-5 font-medium">{removeLabel}</span>
              </div>
            </DropdownMenu.Item>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
};

export const FolderGrid = ({
  folderId,
  items,
  positions,
  openMenuId,
  onMenuOpenChange,
  onOpenWidget,
  onRemoveWidget,
  onChangeWidgetPositions,
}: FolderGridProps) => {
  const { t } = useTranslation();
  const suppressOpenRef = useRef(false);
  const [swapTargetIds, setSwapTargetIds] = useState<string[]>([]);
  const [isGridDragging, setIsGridDragging] = useState(false);
  const menuLabel = t('common.action.moreDetails');
  const removeLabel = t('feature.dashboard.favorites.removeProduct');
  // measureBeforeMount keeps `mounted` false until the real container width is measured, so the
  // grid first paints at the correct width instead of the hook's default initialWidth (1280) and
  // then animating into place via the bundled .react-grid-item transition.
  const { width, mounted, containerRef } = useContainerWidth({ measureBeforeMount: true });

  const layout = useMemo(() => toGridLayout(items, positions), [items, positions]);
  const occupiedRows = Math.max(
    1,
    layout.reduce((max, item) => Math.max(max, item.y + 1), 0),
  );
  const maxRows = occupiedRows + 1;
  const visibleRows = isGridDragging ? maxRows : occupiedRows;
  const minHeight = visibleRows * ROW_HEIGHT + (visibleRows - 1) * GAP;
  const compactor = useMemo(() => createPreventCollisionCompactor(), []);
  const colWidth = GRID_COLS > 0 ? (width - GAP * (GRID_COLS - 1)) / GRID_COLS : 0;

  const commitPositions = useCallback(
    (nextLayout: Layout) => {
      const nextPositions = layoutToPositions(nextLayout);
      const currentPositions = layoutToPositions(layout);
      const hasChanged = Object.entries(nextPositions).some(([id, position]) => {
        const current = currentPositions[id];
        return !current || current.x !== position.x || current.y !== position.y;
      });

      if (!hasChanged) return;
      onChangeWidgetPositions(nextPositions);
    },
    [layout, onChangeWidgetPositions],
  );

  const findSwapTarget = useCallback(
    (event: Event, draggedId: string): LayoutItem | null => {
      if (!containerRef.current || !(event instanceof MouseEvent)) return null;

      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const targetX = Math.floor(mouseX / (colWidth + GAP));
      const targetY = Math.floor(mouseY / (ROW_HEIGHT + GAP));
      if (targetX < 0 || targetX >= GRID_COLS || targetY < 0 || targetY >= maxRows) return null;

      return layout.find(item => item.i !== draggedId && item.x === targetX && item.y === targetY) ?? null;
    },
    [containerRef, colWidth, layout, maxRows],
  );

  const handleDragStart = () => {
    suppressOpenRef.current = true;
    setIsGridDragging(true);
    if (!openMenuId) return;
    onMenuOpenChange(openMenuId, false);
  };

  const allowOpenAfterDrag = () => {
    setIsGridDragging(false);
    setTimeout(() => {
      suppressOpenRef.current = false;
    }, 0);
  };

  const handleDrag = useCallback(
    (_layout: Layout, oldItem: LayoutItem | null, _newItem: LayoutItem | null, _placeholder: LayoutItem | null, event: Event) => {
      if (!oldItem) {
        setSwapTargetIds([]);
        return;
      }

      const target = findSwapTarget(event, oldItem.i);
      setSwapTargetIds(target ? [target.i] : []);
    },
    [findSwapTarget],
  );

  const handleDragStop = useCallback(
    (
      _nextLayout: Layout,
      oldItem: LayoutItem | null,
      newItem: LayoutItem | null,
      _placeholder: LayoutItem | null,
      event: Event,
    ) => {
      setSwapTargetIds([]);
      allowOpenAfterDrag();
      if (!oldItem || !newItem) return;

      if (newItem.x !== oldItem.x || newItem.y !== oldItem.y) {
        commitPositions(layout.map(item => (item.i === oldItem.i ? { ...item, x: newItem.x, y: newItem.y } : item)));
        return;
      }

      const targetItem = findSwapTarget(event, oldItem.i);
      if (!targetItem) return;

      commitPositions(
        layout.map(item => {
          if (item.i === oldItem.i) return { ...item, x: targetItem.x, y: targetItem.y };
          if (item.i === targetItem.i) return { ...item, x: oldItem.x, y: oldItem.y };
          return item;
        }),
      );
    },
    [commitPositions, findSwapTarget, layout],
  );

  const swapOverlays = swapTargetIds
    .map(id => layout.find(item => item.i === id))
    .filter((item): item is LayoutItem => Boolean(item))
    .map(item => ({
      id: item.i,
      left: item.x * (colWidth + GAP),
      top: item.y * (ROW_HEIGHT + GAP),
      width: colWidth,
      height: ROW_HEIGHT,
    }));

  const handleOpenWidget = (widgetId: string) => {
    if (suppressOpenRef.current) return;
    onOpenWidget(widgetId);
  };

  return (
    <div ref={containerRef} className="relative w-full" style={{ minHeight }}>
      {mounted ? (
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: layout }}
          breakpoints={{ lg: 0 }}
          cols={{ lg: GRID_COLS }}
          compactor={compactor}
          maxRows={maxRows}
          rowHeight={ROW_HEIGHT}
          margin={[GAP, GAP]}
          containerPadding={CONTAINER_PADDING}
          width={width}
          resizeConfig={{ enabled: false }}
          dragConfig={{ enabled: true, handle: '.folder-grid-drag-handle', cancel: '.folder-grid-action' }}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragStop={handleDragStop}
        >
          {items.map(item => {
            const menuId = `favorite:${folderId}:${item.widgetId}`;

            return (
              <div key={item.widgetId}>
                <FolderGridItem
                  item={item}
                  menuId={menuId}
                  isMenuOpen={openMenuId === menuId}
                  menuLabel={menuLabel}
                  removeLabel={removeLabel}
                  onMenuOpenChange={onMenuOpenChange}
                  onOpenWidget={handleOpenWidget}
                  onRemoveWidget={onRemoveWidget}
                />
              </div>
            );
          })}
        </ResponsiveGridLayout>
      ) : null}

      {swapOverlays.map(({ id, ...style }) => (
        <div key={id} className="dashboard-swap-overlay" style={style} />
      ))}
    </div>
  );
};
