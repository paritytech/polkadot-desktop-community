import { createSideEffect } from '@/shared/di';

// Fan-out request to reload a product surface, keyed by the product or
// executable identifier. Webviews hosting that identifier remount; the refresh
// button, the reload shortcut, and the clear-cache flow fire it. It carries no
// state of its own — it pairs with `productLoading` (this aggregate's state) to
// derive "is this product refreshing", which is why the two live together.
export const onProductRefreshRequestedSideEffect = createSideEffect<{ identifier: string }>({
  name: 'onProductRefreshRequested',
});
