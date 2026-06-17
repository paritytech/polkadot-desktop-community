import { GRID_MARGIN } from '@/shared/components';
import { type WidgetSizeIconVariant, WIDGET_VARIANT_GRID_SIZE } from '@/domains/application';

import { type WidgetSize } from './types';

// Re-export layout constants from domain
export {
  ALLOWED_WIDGET_HEIGHTS,
  DEFAULT_RESIZE_HANDLES,
  FAVORITES_FOLDER_ID,
  FOLDER_DEFAULT_HEIGHT,
  FOLDER_MIN_HEIGHT,
  MAX_GRID_ROWS,
  MAX_WIDGET_HEIGHT,
  MAX_WIDGET_WIDTH,
} from '@/domains/application';

// Maps each widget-size variant to its grid dimensions (the canonical footprint
// owned by the domain) and i18n label. Consumed by the widget menu and the
// add-widget modal so the mapping has a single source.
export const WIDGET_SIZE_CONFIG: Record<WidgetSizeIconVariant, { size: WidgetSize; labelKey: string }> = {
  small: { size: WIDGET_VARIANT_GRID_SIZE.small, labelKey: 'feature.dashboard.widgetMenu.sizeSmall' },
  medium: { size: WIDGET_VARIANT_GRID_SIZE.medium, labelKey: 'feature.dashboard.widgetMenu.sizeMedium' },
  large: { size: WIDGET_VARIANT_GRID_SIZE.large, labelKey: 'feature.dashboard.widgetMenu.sizeLarge' },
  horizontal: { size: WIDGET_VARIANT_GRID_SIZE.horizontal, labelKey: 'feature.dashboard.widgetMenu.sizeHorizontal' },
};

// Available widget sizes
export const WIDGET_SIZES = {
  ICON: { w: 1, h: 1, label: 'Icon' },
  HALF: { w: 1, h: 4, label: 'Half' },
  FULL: { w: 1, h: 8, label: 'Full' },
} as const;

export type WidgetSizeKey = keyof typeof WIDGET_SIZES;

// Helper functions
export const getWidgetSize = (sizeKey: WidgetSizeKey) => WIDGET_SIZES[sizeKey];

// UI-specific constants
export const DEFAULT_ROW_HEIGHT = 100;
export const DEFAULT_MARGIN: [number, number] = [GRID_MARGIN, GRID_MARGIN];
