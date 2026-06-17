import { type WidgetSizeIconVariant } from '@/domains/application';

export type WidgetCardDefinition = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  previewVariant: WidgetSizeIconVariant;
  sizeVariants: WidgetSizeIconVariant[];
};

// TODO: abstract these menu items out via DI instead of hardcoding them here —
// the way native dashboard cards are contributed through `addableDashboardCardsPipeline`
// / `dashboardCardSDK` (see `features/dashboard/di.tsx`). Removes the hardcoded
// 'product-widget' / 'chat-widget' ids and the `isChat` branching downstream.
export const PLACEHOLDER_WIDGET_CARDS: WidgetCardDefinition[] = [
  {
    id: 'product-widget',
    titleKey: 'feature.dashboard.addWidget.cards.product.title',
    descriptionKey: 'feature.dashboard.addWidget.cards.product.description',
    previewVariant: 'small',
    sizeVariants: ['small', 'medium', 'large', 'horizontal'],
  },
  {
    id: 'chat-widget',
    titleKey: 'feature.dashboard.addWidget.cards.chat.title',
    descriptionKey: 'feature.dashboard.addWidget.cards.chat.description',
    previewVariant: 'small',
    sizeVariants: ['small', 'medium', 'large'],
  },
];
