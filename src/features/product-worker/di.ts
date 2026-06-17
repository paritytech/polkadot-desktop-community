import { createTransformer } from '@/shared/di';
import { type TabRef } from '@/aggregates/browser-tabs';

// Resolves the product id a browser tab hosts, or `null` if the tab is not a product tab.
// product-worker stays agnostic about how a tab is classified as a product — the feature that
// owns the product-tab convention (browser) injects the classifier. This keeps the browser-tabs
// aggregate generic: it never enumerates which tab `type` means "product".
export const resolveTabProductIdTransformer = createTransformer<TabRef, string>({
  name: 'resolveTabProductId',
});
