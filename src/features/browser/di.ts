import { type ReactNode } from 'react';

import { createSideEffect, createSlot, createTransformer } from '@/shared/di';
import { type DotNsUrl, type Product } from '@/domains/product';
import { type TabRef } from '@/aggregates/browser-tabs';

export type AddressBarProductSlotProps = {
  // Resolved chain/persisted product — only set on `/product/:id` routes. Native SPA
  // subjects (e.g. chat) use the leading slot with `product=null`; they own their
  // affordance and must not rely on a legacy product row for the same id.
  product: Product | null;
};

export const addressBarProductLeadingSlot = createSlot<AddressBarProductSlotProps>({
  name: 'addressBarProductLeadingSlot',
});

export const addressBarProductTrailingSlot = createSlot<AddressBarProductSlotProps>({
  name: 'addressBarProductTrailingSlot',
});

// Resolves the address-bar leading icon for a subject that has no persisted
// product row to derive a favicon from (native SPA subjects such as chat).
// Providers return their icon node for a matching productId and fall through
// (null) otherwise, so the generic ProductIcon/Polkadot fallback still renders.
export const resolveAddressBarProductIconTransformer = createTransformer<
  { productId: string; product: Product | null },
  ReactNode
>({ name: 'resolveAddressBarProductIcon' });

export type AddressBarFocusOptions = {
  newTab?: boolean;
  // What the bar was showing, so the surface opens on it rather than empty. Only
  // the bar itself passes this — a new tab starts from nothing by definition.
  initialText?: string;
};

export const focusAddressBarSideEffect = createSideEffect<AddressBarFocusOptions>({ name: 'focusAddressBar' });

export const openDotNsUrlSideEffect = createSideEffect<DotNsUrl>({ name: 'openDotNsUrl' });

export type ProductAddToDashboardParams = {
  productId: string;
};

export const productAddToDashboardSideEffect = createSideEffect<ProductAddToDashboardParams>({
  name: 'productAddToDashboard',
});

// Tab-strip item visuals (icon + label). `setDeeplink` is pre-scoped to the tab's id.
export const tabContentSlot = createSlot<{ tab: TabRef; setDeeplink: (deeplink: string) => void; isActive: boolean }>({
  name: 'tabContent',
});

// The screen a tab shows while its product surface loads. A provider that knows
// why a load is slow returns its own; falling through leaves the plain one.
export const resolveProductLoaderTransformer = createTransformer<{ identifier: string }, ReactNode>({
  name: 'resolveProductLoader',
});
