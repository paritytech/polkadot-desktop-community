import { createFeature } from '@/shared/feature';
import { persistentSlot } from '@/features/app-shell';
import { addressBarProductTrailingSlot } from '@/features/browser';
import { productActionsMenuItemsSlot } from '@/features/product-actions-menu';
import { productSettingsSectionsSlot } from '@/features/product-settings';

import { OfflineAccessDialogHost } from './ui/OfflineAccessDialogHost';
import { OfflineAccessMenuItem } from './ui/OfflineAccessMenuItem';
import { OfflineAccessSection } from './ui/OfflineAccessSection';
import { PinIndicator } from './ui/PinIndicator';
import { UpdateVersionMenuItem } from './ui/UpdateVersionMenuItem';

export const offlineAccessFeature = createFeature({ name: 'browser/offline-access' });

offlineAccessFeature.inject(productActionsMenuItemsSlot, {
  order: 30,
  render: ({ productId, closeMenu }) => (
    <>
      <OfflineAccessMenuItem productId={productId} closeMenu={closeMenu} />
      <UpdateVersionMenuItem productId={productId} closeMenu={closeMenu} />
    </>
  ),
});

offlineAccessFeature.inject(addressBarProductTrailingSlot, {
  order: 10,
  render: ({ product }) => (product ? <PinIndicator productId={product.baseName} /> : null),
});

offlineAccessFeature.inject(productSettingsSectionsSlot, {
  order: 10,
  render: ({ productId }) => <OfflineAccessSection productId={productId} />,
});

offlineAccessFeature.inject(persistentSlot, () => <OfflineAccessDialogHost />);
