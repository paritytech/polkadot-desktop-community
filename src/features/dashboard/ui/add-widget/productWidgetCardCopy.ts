import { type Product } from '@/domains/product';

import { type AddWidgetModalCardCopy } from './types';

export const getProductWidgetCardCopy = (
  product: Product,
  fallbackDescriptionKey: string,
  t: (key: string) => string,
): AddWidgetModalCardCopy => {
  const description = product.description.trim();

  return {
    title: product.displayName,
    description: description || t(fallbackDescriptionKey),
  };
};
