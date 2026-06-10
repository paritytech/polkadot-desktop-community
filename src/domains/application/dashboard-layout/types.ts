import { type ResizeHandleAxis } from 'react-grid-layout';

export type FolderItemPositions = Record<string, { x: number; y: number }>;

export type WidgetSizeKey = 'ICON' | 'HALF' | 'FULL';

export type WidgetSizeIconVariant = 'small' | 'medium' | 'large' | 'horizontal';

// Layout rules govern resize/placement constraints + the resize-menu options
// for one card. Each card kind contributes these via DI; the dashboard treats
// the result as opaque from the layout-math side.
export type DashboardCardLayoutRules = {
  minH?: number;
  maxH?: number;
  minW?: number;
  maxW?: number;
  // Options shown in the topbar's size-picker menu. Empty/undefined → menu
  // size section hidden.
  menuSizes?: WidgetSizeIconVariant[];
  // Hints used by the Add Widget flow (install-time picker, not the resize
  // menu). Optional — only relevant for cards launched via that flow.
  availableSizes?: WidgetSizeKey[];
  defaultSize?: WidgetSizeKey;
};

// Opaque per-card payload. `kind` identifies which feature's handlers process
// this card; the rest of the fields are owned by that feature. The dashboard
// renders the card through DI handlers keyed on `kind` and has no awareness
// of payload internals — the index signature lets each kind store its own
// fields without polluting this type.
export type DashboardCardPayload = {
  kind: string;
  [key: string]: unknown;
};

// Folder-specific payload. Defined here (rather than inside the dashboard
// feature) because the dashboard-layout domain service has built-in folder
// operations (`addIconToFavorites`, `removeIconFromFolder`, etc.) that read
// and write folder items. External callers should still treat folders as
// opaque payloads — this type is the internal handshake.
export type FolderCardPayload = {
  kind: 'folder';
  items: string[];
  positions?: FolderItemPositions;
};

// A placed card on the dashboard grid. Same grid fields as the legacy
// `ExtendedLayoutItem` so layout math stays payload-agnostic.
export type DashboardCard = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  resizeHandles?: ResizeHandleAxis[];
  isDraggable?: boolean;
  isResizable?: boolean;
  static?: boolean;
  payload: DashboardCardPayload;
};

export type DashboardLayout = {
  id: string;
  pages: DashboardCard[][];
  activePageIndex: number;
  updatedAt: number;
};
