import { type ComponentType } from 'react';

import { ChatIcon } from '@/shared/assets';

// Map of native product IDs to their React icon components
export const NATIVE_PRODUCT_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  chat: ChatIcon,
};

// Helper to get icon for a product
export function getProductIcon(productId: string): ComponentType<{ className?: string }> | null {
  return NATIVE_PRODUCT_ICONS[productId] ?? null;
}
