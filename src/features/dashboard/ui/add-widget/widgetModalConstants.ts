import { type WidgetSizeIconVariant } from '@/domains/application';
import { WIDGET_SIZE_CONFIG } from '../../constants';

export type WidgetCardDefinition = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  previewVariant: WidgetSizeIconVariant;
  sizeVariants: WidgetSizeIconVariant[];
};

const isWidgetSizeVariant = (value: string): value is WidgetSizeIconVariant => value in WIDGET_SIZE_CONFIG;

export const getVariantFromGridSize = (w: number, h: number): WidgetSizeIconVariant => {
  for (const [variant, config] of Object.entries(WIDGET_SIZE_CONFIG)) {
    if (!isWidgetSizeVariant(variant)) continue;
    if (config.size.w === w && config.size.h === h) return variant;
  }

  return 'small';
};

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
