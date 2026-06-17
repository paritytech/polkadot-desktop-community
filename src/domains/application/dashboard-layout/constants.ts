import { type ResizeHandleAxis } from 'react-grid-layout';

import { type DashboardCard, type WidgetSizeIconVariant } from './types';

// Layout grid constants
export const ALLOWED_WIDGET_HEIGHTS = [2, 4, 8];
export const DEFAULT_RESIZE_HANDLES: ResizeHandleAxis[] = ['s'];
export const MAX_WIDGET_WIDTH = 2;
export const MAX_WIDGET_HEIGHT = 8;
export const MAX_GRID_ROWS = 8;

// Canonical grid footprint for each size variant — the single source of truth
// shared by the resize menu, the add-widget modal, and the size-hint-derived
// layout bounds in the service. These are real dashboard grid cells (cols × rows).
export const WIDGET_VARIANT_GRID_SIZE: Record<WidgetSizeIconVariant, { w: number; h: number }> = {
  small: { w: 1, h: 2 },
  medium: { w: 1, h: 4 },
  large: { w: 1, h: 8 },
  horizontal: { w: 2, h: 4 },
};

// A widget's declared `height` hints are size identifiers, NOT grid rows: the
// widget lists which sizes it supports. `0` opts into horizontal (only valid
// together with `width === 2`); the rest map to the vertical variants.
export const HEIGHT_HINT_TO_VARIANT: Record<number, WidgetSizeIconVariant> = {
  1: 'small',
  2: 'medium',
  4: 'large',
};

export const HORIZONTAL_HEIGHT_MARKER = 0;

export const SIZE_VARIANT_ORDER: WidgetSizeIconVariant[] = ['small', 'medium', 'large', 'horizontal'];

export const DEFAULT_DASHBOARD_WIDGET_PRODUCT_ID = 'browse.dot';

export const FAVORITES_FOLDER_ID = 'folder-favorites';
export const FOLDER_MIN_HEIGHT = 2;
export const FOLDER_DEFAULT_HEIGHT = 4;

// The dashboard a brand-new user starts with — a single product widget. Used as
// the hook's pre-load visual default and persisted by `seedDefaultMainLayout`.
const DEFAULT_LAYOUT: DashboardCard[] = [
  {
    i: DEFAULT_DASHBOARD_WIDGET_PRODUCT_ID,
    x: 1,
    y: 2,
    w: 2,
    h: 4,
    minW: 1,
    maxW: MAX_WIDGET_WIDTH,
    minH: 4,
    maxH: MAX_WIDGET_HEIGHT,
    resizeHandles: [...DEFAULT_RESIZE_HANDLES],
    payload: { kind: 'product:widget', productId: DEFAULT_DASHBOARD_WIDGET_PRODUCT_ID },
  },
];

export const DEFAULT_DASHBOARD_PAGES: DashboardCard[][] = [DEFAULT_LAYOUT];
