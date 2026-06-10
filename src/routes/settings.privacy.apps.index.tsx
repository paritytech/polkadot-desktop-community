import { createFileRoute } from '@tanstack/react-router';

import { ProductListSettingsPage } from '@/features/product-settings';

export const Route = createFileRoute('/settings/privacy/apps/')({
  component: ProductListSettingsPage,
});
