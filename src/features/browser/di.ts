import { createSideEffect, createSlot } from '@/shared/di';
import { type DotNsUrl, type Product } from '@/domains/product';
import { type TabRef } from '@/aggregates/browser-tabs';

export type AddressBarProductSlotProps = {
  product: Product | null;
  isFocused: boolean;
};

export const addressBarProductLeadingSlot = createSlot<AddressBarProductSlotProps>({
  name: 'addressBarProductLeadingSlot',
});

export const addressBarProductTrailingSlot = createSlot<AddressBarProductSlotProps>({
  name: 'addressBarProductTrailingSlot',
});

export type AddressBarFocusOptions = {
  newTab?: boolean;
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

// Hover-card body (title + extra rows). The strip appends the generic RAM-usage row.
export const tabHoverSlot = createSlot<{ tab: TabRef }>({ name: 'tabHover' });
