import { createFeature } from '@/shared/feature';
import { lifecycleUseCase } from '@/domains/product';
import { BrowserTabsNavigationBinding, browserTabs } from '@/aggregates/browser-tabs';
import { persistentSlot, tabBarSlot, topBarCenterSlot, topBarCenterTrailingSlot, topBarLeadingSlot } from '@/features/app-shell';
import { resolveTabProductIdTransformer } from '@/features/product-worker';

import { addressBarProductTrailingSlot, tabContentSlot, tabHoverSlot } from './di';
import { NEW_TAB, PRODUCT } from './tabs/helpers';
import { AddressBar } from './ui/AddressBar';
import { AddressBarRefreshButton } from './ui/AddressBarRefreshButton';
import { BrowserTabBinding } from './ui/BrowserTabBinding';
import { NavigationButtons } from './ui/NavigationButtons';
import { NewTabButton } from './ui/NewTabButton';
import { NewTabContent } from './ui/NewTabContent';
import { NewTabHover } from './ui/NewTabHover';
import { ProductTabContent } from './ui/ProductTabContent';
import { ProductTabHover } from './ui/ProductTabHover';
import { Tabs } from './ui/Tabs';

export const browserFeature = createFeature({
  name: 'browser/root-presentation',
});

browserFeature.inject(topBarCenterSlot, { order: 0, render: () => <AddressBar listenForFocus /> });
browserFeature.inject(topBarCenterTrailingSlot, { order: 0, render: () => <NewTabButton /> });
browserFeature.inject(tabBarSlot, { order: 0, render: () => <Tabs /> });
browserFeature.inject(topBarLeadingSlot, { order: 1, render: () => <NavigationButtons /> });
browserFeature.inject(addressBarProductTrailingSlot, {
  order: 0,
  render: ({ product, isFocused }) => (product ? <AddressBarRefreshButton product={product} isFocused={isFocused} /> : null),
});
browserFeature.inject(lifecycleUseCase.onProductForgottenSideEffect, ({ productId }) => {
  browserTabs.removeAliveTabId(productId);
});

// The browser owns the product-tab convention: a tab is a product tab when its `type` is `PRODUCT`,
// and its `id` is the product id. Provide that classification to product-worker, so the tabs aggregate
// stays generic about tab types.
browserFeature.inject(resolveTabProductIdTransformer, tab => (tab.type === PRODUCT ? tab.id : null));

browserFeature.inject(tabContentSlot, ({ tab, setDeeplink, isActive }) =>
  tab.type === PRODUCT ? (
    <ProductTabContent id={tab.id} isActive={isActive} setDeeplink={setDeeplink} />
  ) : tab.type === NEW_TAB ? (
    <NewTabContent isActive={isActive} />
  ) : null,
);
browserFeature.inject(tabHoverSlot, ({ tab }) =>
  tab.type === PRODUCT ? <ProductTabHover id={tab.id} /> : tab.type === NEW_TAB ? <NewTabHover /> : null,
);
browserFeature.inject(persistentSlot, () => (
  <>
    <BrowserTabBinding />
    <BrowserTabsNavigationBinding />
  </>
));
