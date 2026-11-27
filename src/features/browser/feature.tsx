import { createFeature } from '@/shared/feature';
import { lifecycleUseCase } from '@/domains/product';
import { BrowserTabsNavigationBinding, browserTabs } from '@/aggregates/browser-tabs';
import { persistentSlot, tabBarSlot, topBarCenterSlot, topBarCenterTrailingSlot, topBarLeadingSlot } from '@/features/app-shell';
import { resolveTabProductIdTransformer } from '@/features/product-worker';

import { addressBarProductTrailingSlot, tabContentSlot } from './di';
import { NEW_TAB, PRODUCT } from './tabs/helpers';
import { AddressBar } from './ui/AddressBar';
import { AddressBarRefreshButton } from './ui/AddressBarRefreshButton';
import { AppModalityOpenBinding } from './ui/AppModalityOpenBinding';
import { BrowserTabBinding } from './ui/BrowserTabBinding';
import { NavigationButtons } from './ui/NavigationButtons';
import { NewTabButton } from './ui/NewTabButton';
import { NewTabContent } from './ui/NewTabContent';
import { ProductTabContent } from './ui/ProductTabContent';
import { SandboxWindowOpenBinding } from './ui/SandboxWindowOpenBinding';
import { Tabs } from './ui/Tabs';

export const browserFeature = createFeature({
  name: 'browser/root-presentation',
});

browserFeature.inject(topBarCenterSlot, { order: 0, render: () => <AddressBar /> });
browserFeature.inject(topBarCenterTrailingSlot, { order: 0, render: () => <NewTabButton /> });
browserFeature.inject(tabBarSlot, { order: 0, render: () => <Tabs /> });
browserFeature.inject(topBarLeadingSlot, { order: 1, render: () => <NavigationButtons /> });
browserFeature.inject(addressBarProductTrailingSlot, {
  order: 0,
  render: ({ product }) => (product ? <AddressBarRefreshButton product={product} /> : null),
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
browserFeature.inject(persistentSlot, () => (
  <>
    <BrowserTabBinding />
    <BrowserTabsNavigationBinding />
    <AppModalityOpenBinding />
    <SandboxWindowOpenBinding />
  </>
));
