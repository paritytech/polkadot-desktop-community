export { Dashboard } from './ui/Dashboard';
export {
  type AddWidgetContributedEntry,
  type AddWidgetPanelContext,
  type AddableDashboardCard,
  type DashboardAddOutcome,
  type DashboardAddRequest,
  addToDashboardModalTransformer,
  addWidgetPanelTransformer,
  addableDashboardCardsPipeline,
  dashboardCardActionsSlot,
  dashboardCardAddTransformer,
  dashboardCardContentTransformer,
  dashboardCardMenuItemsSlot,
  dashboardCardMetadataTransformer,
  dashboardCardSDK,
  folderItemContentTransformer,
  openAddToFavoritesSideEffect,
  openFavoriteItemSideEffect,
  openFavoritesSideEffect,
} from './di';
export { buildNativeDashboardCard } from './nativeDashboardCards';
export { dashboardFeature } from './feature';

export { AddToDashboardDialogShell } from './ui/AddToDashboardDialogShell';
export { DashboardCardChrome } from './ui/DashboardCardChrome';
export { ShortcutIcon } from './ui/ShortcutIcon';
export { WidgetMenu } from './ui/WidgetMenu';
export { WidgetTopbarAction } from './ui/WidgetTopbarAction';
export type { CardRenderProps, DashboardCardMetadata, FolderItemIconSize, WidgetSize } from './types';

// Generic dashboard host seams a content provider (e.g. `product-dashboard`)
// fills from outside. The host owns these; providers register handlers / read
// state through them without importing dashboard internals directly.
export { isNativeAddableDashboardId, openNativeAddToDashboardDialog } from './addableDashboardCards';
export { getAddToDashboardDialogTarget, openAddToDashboardDialog } from './state/addToDashboardDialog';
export { clearAddWidgetCatalogSource, publishAddWidgetCatalogSource, useAddWidgetModalOpen } from './state/addWidgetCatalog';
export { useAddDashboardContent } from './hooks/useAddDashboardContent';
export { WIDGET_SIZE_CONFIG } from './constants';
export { PLACEHOLDER_WIDGET_CARDS } from './ui/add-widget/widgetModalConstants';
export { useWidgetAddedToast } from './ui/add-widget/useWidgetAddedToast';
export { AddWidgetFavoritesButton, AddWidgetModalCard } from './ui/add-widget/widgetModalParts';
export { AddWidgetSidebarIcon } from './ui/add-widget/AddWidgetSidebarIcon';
export type { AddWidgetModalCardCopy } from './ui/add-widget/types';
export { FolderItemCell } from './ui/folder/FolderItemCell';
