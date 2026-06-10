import { type ComponentType, type ReactNode } from 'react';

import { type DashboardCard } from '@/domains/application';
import { type Icon } from '@/domains/product';

export type WidgetSize = {
  w: number;
  h: number;
};

export type FolderItem = {
  widgetId: string;
  icon?: Icon;
  NativeIcon?: ComponentType<{ className?: string }>;
  name: string;
};

// Props passed to dashboardCardContentTransformer handlers. Carries the
// current grid sizing + interaction callbacks; the handler decides what to
// render (and how) for its payload kind.
export type CardRenderProps = {
  card: DashboardCard;
  menuId: string;
  isMenuOpen: boolean;
  isActivePage: boolean;
  width: number;
  height: number;
  onMenuOpenChange: (menuId: string, open: boolean) => void;
  onResizeCard: (size: WidgetSize) => void;
  onRemoveCard: () => void;
  onCleanupCards: () => void;
};

// Visual metadata for one card kind, consumed by `DashboardCardChrome` to
// fill in the topbar. All fields are optional: cards that opt out of the
// chrome (e.g. shortcut-sized product widgets) simply don't register one.
export type DashboardCardMetadata = {
  label?: ReactNode;
  icon?: ReactNode;
  removeLabel?: ReactNode;
};
