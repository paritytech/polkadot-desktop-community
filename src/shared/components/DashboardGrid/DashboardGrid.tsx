import 'react-grid-layout/css/styles.css';
import './DashboardGrid.css';

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Layout, type LayoutItem, ResponsiveGridLayout, noCompactor, useContainerWidth } from 'react-grid-layout';
import { snapToGrid } from 'react-grid-layout/core';

import { layoutInteractionSession } from './layoutInteractionSession';

export const GRID_COLS = 4;

// Canonical horizontal spacing between grid columns (px). Widgets render with this margin
// (the dashboard feature's DEFAULT_MARGIN derives from it). Exported so surfaces outside the
// grid can size themselves to whole widget columns.
export const GRID_MARGIN = 8;
// The grid container is centered and clamped to this px range; the per-column width is derived
// from the clamped width, so anything matching widget proportions must clamp identically.
export const GRID_MAX_WIDTH = 1660;
export const GRID_MIN_WIDTH = 1366;

/**
 * CSS width of a widget spanning `span` grid columns, returned as a `calc(...)` string sized
 * against the element's own parent (`100%`). It stays responsive via CSS `clamp()` with no
 * measurement, mirroring how widgets reflow. Single source of truth for surfaces that must line
 * up with widget columns (e.g. the settings and chat side menus).
 */
export function widgetSpanWidthCss(span: number): string {
  const clampedWidth = `clamp(${GRID_MIN_WIDTH}px, 100%, ${GRID_MAX_WIDTH}px)`;
  const columns = `(${clampedWidth} - ${GRID_MARGIN * (GRID_COLS + 1)}px) / ${GRID_COLS} * ${span}`;
  const gutters = GRID_MARGIN * (span - 1);

  return gutters > 0 ? `calc(${columns} + ${gutters}px)` : `calc(${columns})`;
}

const VIEWPORT_EDGE_MARGIN_PX = 72;
const VIEWPORT_EDGE_DWELL_MS = 420;

export const DASHBOARD_GRID_SNAP_Y_STEP = 8 / 4;
const DEFAULT_ALLOWED_WIDGET_HEIGHTS = [2, 4, 8];

const createPreventCollisionCompactor = () => ({
  ...noCompactor,
  preventCollision: true,
});

const createMaxRowsConstraint = (maxRows: number) => ({
  name: 'maxRows',
  constrainPosition(item: LayoutItem, x: number, y: number) {
    const maxY = Math.max(0, maxRows - item.h);
    return { x, y: Math.min(y, maxY) };
  },
  constrainSize(item: LayoutItem, w: number, h: number) {
    const maxH = maxRows - item.y;
    return { w, h: Math.min(h, maxH) };
  },
});

// Prevents items from going outside horizontal grid bounds (x < 0 or x + w > cols).
// react-grid-layout's calcXYRaw does not clamp x, which can lead to correctBounds()
// setting w = cols when x becomes negative — corrupting the layout width.
const clampToGridBounds = (cols: number) => ({
  name: 'clampToGridBounds',
  constrainPosition(item: LayoutItem, x: number, y: number) {
    return { x: Math.max(0, Math.min(x, cols - item.w)), y };
  },
});

const DEFAULT_MAX_ROWS = 8;
const BOTTOM_GAP = 16;

type Rect = { x: number; y: number; w: number; h: number };

const rectsOverlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const isRectInBounds = (r: Rect, cols: number, maxRows: number) =>
  r.x >= 0 && r.y >= 0 && r.x + r.w <= cols && r.y + r.h <= maxRows;

const isLayoutValid = (layout: Layout, cols: number, maxRows: number): boolean => {
  for (let i = 0; i < layout.length; i++) {
    const a = layout[i];
    if (!a || !isRectInBounds(a, cols, maxRows)) return false;
    for (let j = i + 1; j < layout.length; j++) {
      const b = layout[j];
      if (!b) continue;
      if (rectsOverlap(a, b)) return false;
    }
  }
  return true;
};

const computeSwapLayout = (
  layout: Layout,
  oldItem: LayoutItem,
  targetItem: LayoutItem,
  cols: number,
  maxRows: number,
): Layout | null => {
  const draggedNewPos: Rect = { x: targetItem.x, y: targetItem.y, w: oldItem.w, h: oldItem.h };
  const targetNewPos: Rect = { x: oldItem.x, y: oldItem.y, w: targetItem.w, h: targetItem.h };

  if (!isRectInBounds(draggedNewPos, cols, maxRows)) return null;
  if (!isRectInBounds(targetNewPos, cols, maxRows)) return null;

  const displacedIds = new Set<string>();
  for (const item of layout) {
    if (item.i === oldItem.i || item.i === targetItem.i) continue;
    if (rectsOverlap(item, draggedNewPos)) displacedIds.add(item.i);
  }

  const next: Layout = layout.map(item => {
    if (item.i === oldItem.i) return { ...item, x: targetItem.x, y: targetItem.y };
    if (item.i === targetItem.i) return { ...item, x: oldItem.x, y: oldItem.y };
    if (displacedIds.has(item.i)) return { ...item, x: oldItem.x };
    return item;
  });

  return isLayoutValid(next, cols, maxRows) ? next : null;
};

const detectViewportEdgeDirection = (event: Event): -1 | 1 | null => {
  if (!(event instanceof MouseEvent)) return null;
  const margin = Math.max(VIEWPORT_EDGE_MARGIN_PX, window.innerWidth * 0.11);
  if (event.clientX >= window.innerWidth - margin) return 1;
  if (event.clientX <= margin) return -1;
  return null;
};

type CrossPageEdgeDwellConfig = {
  canDwellNavigate: (direction: -1 | 1) => boolean;
  onDwellNavigate: (direction: -1 | 1) => void;
  onDragSessionStart?: () => void;
  onDragSessionEnd?: () => void;
};

type DashboardGridProps = {
  layout: Layout;
  children: ReactNode;
  rowHeight?: number;
  margin?: [number, number];
  maxRows?: number;
  allowedHeights?: number[];
  getItemType?: (id: string) => 'widget' | 'folder' | undefined;
  onLayoutChange: (layout: Layout) => void;
  onMoveToAdjacentPage?: (itemId: string, direction: -1 | 1) => void;
  canMoveToAdjacentPage?: (direction: -1 | 1) => boolean;
  crossPageEdgeDwell?: CrossPageEdgeDwellConfig;
  onResolveScrollCrossPageDrop?: (itemId: string) => boolean;
};

const snapToAllowedHeight = (height: number, allowedHeights: number[]): number => {
  return allowedHeights.reduce((prev, curr) => (Math.abs(curr - height) < Math.abs(prev - height) ? curr : prev));
};

export const DashboardGrid = ({
  layout,
  onLayoutChange,
  children,
  rowHeight: propRowHeight,
  margin: propMargin,
  maxRows = DEFAULT_MAX_ROWS,
  allowedHeights = DEFAULT_ALLOWED_WIDGET_HEIGHTS,
  getItemType,
  onMoveToAdjacentPage,
  canMoveToAdjacentPage,
  crossPageEdgeDwell,
  onResolveScrollCrossPageDrop,
}: DashboardGridProps) => {
  const baseRowHeight = propRowHeight ?? 100;
  const margin: [number, number] = propMargin ?? [4, 4];
  // measureBeforeMount keeps `mounted` false until the real container width is measured, so the
  // grid first paints at the correct width instead of the hook's default initialWidth (1280) and
  // then animating into place via the bundled .react-grid-item transition.
  const { width, mounted, containerRef } = useContainerWidth({ measureBeforeMount: true });

  // Measure available height to scale row height when viewport is too short
  const outerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rowHeight = useMemo(() => {
    if (containerHeight == null) return baseRowHeight;
    const totalMargins = (maxRows - 1) * margin[1];
    const fittedRowHeight = (containerHeight - totalMargins - BOTTOM_GAP) / maxRows;
    return Math.min(baseRowHeight, Math.max(fittedRowHeight, 20));
  }, [containerHeight, baseRowHeight, maxRows, margin]);

  const minHeight = maxRows * rowHeight + (maxRows - 1) * margin[1];
  const compactor = useMemo(() => createPreventCollisionCompactor(), []);
  const constraints = useMemo(
    () => [snapToGrid(1, DASHBOARD_GRID_SNAP_Y_STEP), createMaxRowsConstraint(maxRows), clampToGridBounds(GRID_COLS)],
    [maxRows],
  );

  const skipNextLayoutChangeRef = useRef(false);

  const handleLayoutChange = useCallback(
    (newLayout: Layout) => {
      if (skipNextLayoutChangeRef.current) {
        skipNextLayoutChangeRef.current = false;
        return;
      }
      onLayoutChange(newLayout);
    },
    [onLayoutChange],
  );

  const handleResize = useCallback(
    (_layout: Layout, _oldItem: LayoutItem | null, newItem: LayoutItem | null, placeholder: LayoutItem | null) => {
      if (!newItem || !placeholder) return;
      const type = getItemType?.(newItem.i);
      // Folders: clamp to minH-maxRows (any height), Widgets: snap to allowedHeights.
      const minH = newItem.minH ?? 1;
      const newH =
        type === 'folder'
          ? Math.max(minH, Math.min(maxRows, Math.round(newItem.h)))
          : snapToAllowedHeight(newItem.h, allowedHeights);
      newItem.h = newH;
      placeholder.h = newH;
      newItem.w = 1;
      placeholder.w = 1;
    },
    [allowedHeights, getItemType, maxRows],
  );

  const handleResizeStop = useCallback(
    (_layout: Layout, _oldItem: LayoutItem | null, newItem: LayoutItem | null) => {
      if (!newItem) return;
      const type = getItemType?.(newItem.i);
      // Folders: clamp to minH-maxRows (any height), Widgets: snap to allowedHeights.
      const minH = newItem.minH ?? 1;
      newItem.h =
        type === 'folder'
          ? Math.max(minH, Math.min(maxRows, Math.round(newItem.h)))
          : snapToAllowedHeight(newItem.h, allowedHeights);
      newItem.w = 1;
    },
    [allowedHeights, getItemType, maxRows],
  );

  const colWidth = GRID_COLS > 0 ? (width - margin[0] * (GRID_COLS + 1)) / GRID_COLS : 0;

  const [swapTargetIds, setSwapTargetIds] = useState<string[]>([]);

  const dwellTimerRef = useRef<number | null>(null);
  const dwellEdgeDirRef = useRef<-1 | 1 | null>(null);

  const clearEdgeDwellState = useCallback(() => {
    if (dwellTimerRef.current !== null) {
      window.clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
    dwellEdgeDirRef.current = null;
  }, []);

  useEffect(() => () => clearEdgeDwellState(), [clearEdgeDwellState]);

  const findSwapTarget = useCallback(
    (event: Event, draggedId: string): LayoutItem | null => {
      if (!containerRef.current || !(event instanceof MouseEvent)) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const targetX = Math.floor((mouseX - margin[0]) / (colWidth + margin[0]));
      const targetY = Math.floor((mouseY - margin[1]) / (rowHeight + margin[1]));
      if (targetX < 0 || targetX >= GRID_COLS || targetY < 0 || targetY >= maxRows) return null;

      return (
        layout.find(
          item =>
            item.i !== draggedId &&
            targetX >= item.x &&
            targetX < item.x + item.w &&
            targetY >= item.y &&
            targetY < item.y + item.h,
        ) ?? null
      );
    },
    [layout, colWidth, margin, rowHeight, maxRows, containerRef],
  );

  const detectEdgeDirection = useCallback(
    (event: Event, draggedItem: LayoutItem): -1 | 1 | null => {
      if (!containerRef.current || !(event instanceof MouseEvent)) return null;

      const rect = containerRef.current.getBoundingClientRect();
      const itemWidthPx = draggedItem.w * colWidth + (draggedItem.w - 1) * margin[0];
      const edgeThreshold = Math.max(itemWidthPx / 2, 1);

      if (event.clientX >= rect.right - edgeThreshold) return 1;
      if (event.clientX <= rect.left + edgeThreshold) return -1;
      return null;
    },
    [colWidth, margin, containerRef],
  );

  const handleDrag = useCallback(
    (_layout: Layout, oldItem: LayoutItem | null, newItem: LayoutItem | null, placeholder: LayoutItem | null, event: Event) => {
      if (oldItem && newItem) {
        newItem.w = oldItem.w;
        if (placeholder) placeholder.w = oldItem.w;
      }
      if (!oldItem) {
        setSwapTargetIds([]);
        clearEdgeDwellState();
        return;
      }

      const viewportEdge = detectViewportEdgeDirection(event);
      if (crossPageEdgeDwell && viewportEdge && crossPageEdgeDwell.canDwellNavigate(viewportEdge)) {
        setSwapTargetIds([]);
        if (dwellEdgeDirRef.current !== viewportEdge) {
          clearEdgeDwellState();
          dwellEdgeDirRef.current = viewportEdge;
          dwellTimerRef.current = window.setTimeout(() => {
            dwellTimerRef.current = null;
            crossPageEdgeDwell.onDwellNavigate(viewportEdge);
          }, VIEWPORT_EDGE_DWELL_MS);
        }
      } else {
        clearEdgeDwellState();
        const target = findSwapTarget(event, oldItem.i);
        if (!target) {
          setSwapTargetIds([]);
          return;
        }
        const draggedNewPos: Rect = { x: target.x, y: target.y, w: oldItem.w, h: oldItem.h };
        const ids = [target.i];
        for (const item of layout) {
          if (item.i === oldItem.i || item.i === target.i) continue;
          if (rectsOverlap(item, draggedNewPos)) ids.push(item.i);
        }
        setSwapTargetIds(ids);
      }
    },
    [clearEdgeDwellState, crossPageEdgeDwell, findSwapTarget, layout],
  );

  // When a drop is blocked by preventCollision, swap positions with the widget under the cursor.
  const handleDragStop = useCallback(
    (_layout: Layout, oldItem: LayoutItem | null, newItem: LayoutItem | null, _placeholder: LayoutItem | null, event: Event) => {
      setSwapTargetIds([]);
      clearEdgeDwellState();
      if (!oldItem || !newItem) return;

      if (onResolveScrollCrossPageDrop?.(oldItem.i)) {
        return;
      }

      const viewportEdge = detectViewportEdgeDirection(event);
      const edgeDirection = viewportEdge ?? detectEdgeDirection(event, oldItem);
      if (edgeDirection && onMoveToAdjacentPage && (canMoveToAdjacentPage?.(edgeDirection) ?? true)) {
        skipNextLayoutChangeRef.current = true;
        onMoveToAdjacentPage(oldItem.i, edgeDirection);
        return;
      }

      // Drop only gets blocked when preventCollision leaves position unchanged
      if (newItem.x !== oldItem.x || newItem.y !== oldItem.y) return;

      const targetItem = findSwapTarget(event, oldItem.i);
      if (!targetItem) return;

      const swapped = computeSwapLayout(layout, oldItem, targetItem, GRID_COLS, maxRows);
      if (!swapped) return;

      onLayoutChange(swapped);
    },
    [
      clearEdgeDwellState,
      layout,
      onLayoutChange,
      maxRows,
      findSwapTarget,
      detectEdgeDirection,
      onMoveToAdjacentPage,
      canMoveToAdjacentPage,
      onResolveScrollCrossPageDrop,
    ],
  );

  const handleDragStopWithSession = useCallback(
    (...args: Parameters<typeof handleDragStop>) => {
      try {
        handleDragStop(...args);
      } finally {
        crossPageEdgeDwell?.onDragSessionEnd?.();
        layoutInteractionSession.drag = false;
      }
    },
    [crossPageEdgeDwell, handleDragStop],
  );

  const handleResizeStopWithSession = useCallback(
    (...args: Parameters<typeof handleResizeStop>) => {
      try {
        handleResizeStop(...args);
      } finally {
        layoutInteractionSession.resize = false;
      }
    },
    [handleResizeStop],
  );

  const swapOverlays = swapTargetIds
    .map(id => layout.find(item => item.i === id))
    .filter((item): item is LayoutItem => Boolean(item))
    .map(item => ({
      id: item.i,
      left: item.x * (colWidth + margin[0]) + margin[0],
      top: item.y * (rowHeight + margin[1]) + margin[1],
      width: item.w * colWidth + (item.w - 1) * margin[0],
      height: item.h * rowHeight + (item.h - 1) * margin[1],
    }));

  return (
    <div ref={outerRef} className="scrollbar-hidden flex min-h-0 flex-1 items-center overflow-x-auto overflow-y-hidden">
      <div
        ref={containerRef}
        className="relative mx-auto w-full shrink-0"
        style={{ minHeight, maxWidth: GRID_MAX_WIDTH, minWidth: GRID_MIN_WIDTH }}
      >
        {mounted && (
          <ResponsiveGridLayout
            className="layout"
            layouts={{ lg: layout }}
            breakpoints={{ lg: 0 }}
            cols={{ lg: GRID_COLS }}
            compactor={compactor}
            constraints={constraints}
            maxRows={maxRows}
            rowHeight={rowHeight}
            margin={margin}
            width={width}
            resizeConfig={{ enabled: false, handles: ['s'] }}
            dragConfig={{ enabled: true, handle: '.widget-topbar-drag-handle', cancel: '.widget-topbar-action' }}
            onLayoutChange={handleLayoutChange}
            onResize={handleResize}
            onResizeStart={() => {
              layoutInteractionSession.resize = true;
            }}
            onResizeStop={handleResizeStopWithSession}
            onDrag={handleDrag}
            onDragStart={(_layout, oldItem) => {
              layoutInteractionSession.drag = true;
              clearEdgeDwellState();
              if (oldItem) {
                crossPageEdgeDwell?.onDragSessionStart?.();
              }
            }}
            onDragStop={handleDragStopWithSession}
          >
            {children}
          </ResponsiveGridLayout>
        )}
        {swapOverlays.map(({ id, ...style }) => (
          <div key={id} className="dashboard-swap-overlay" style={style} />
        ))}
      </div>
    </div>
  );
};
