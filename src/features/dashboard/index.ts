export { Dashboard } from './ui/Dashboard';
export {
  type AddableDashboardCard,
  addableDashboardCardsPipeline,
  dashboardCardActionsSlot,
  dashboardCardContentTransformer,
  dashboardCardMetadataTransformer,
  dashboardCardSDK,
} from './di';
export { dashboardFeature } from './feature';

export { NATIVE_PRODUCT_ICONS, getProductIcon } from './productIcons';
export { WidgetSizeIcon } from './ui/icons/WidgetSizeIcon';
export { DashboardCardChrome } from './ui/DashboardCardChrome';
export { ShortcutIcon } from './ui/ShortcutIcon';
export {
  WidgetMenu,
  widgetTopbarActionButtonClass,
  widgetTopbarActionMenuTriggerClass,
  widgetTopbarActionVisibilityClass,
} from './ui/WidgetMenu';
export type { CardRenderProps, DashboardCardMetadata, WidgetSize } from './types';
