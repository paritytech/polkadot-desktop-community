import { firstValueFrom } from 'rxjs';

import { isElectron } from '@/shared/env';
import { createFeature } from '@/shared/feature';
import { lifecycleUseCase, productsResource } from '@/domains/product';

export const notificationsFeature = createFeature({
  name: 'application/notifications',
});

notificationsFeature.inject(lifecycleUseCase.onProductForgottenSideEffect, ({ productId }) => {
  if (!isElectron()) return;
  void window.App.cancelAllNotificationsForProduct(productId).catch(error => {
    console.warn('[notifications] cancelAllNotificationsForProduct failed', { productId, error });
  });
});

// Boot reconcile: cancel notifications whose owning product was uninstalled while
// the app was closed. Called once from the app bootstrap (after the product DB is
// ready) rather than at module-import time, so the host read order stays explicit.
export function bootstrapNotifications() {
  if (!isElectron()) return;

  void firstValueFrom(productsResource.read$({}))
    .then(products => window.App.reconcileNotifications(products.map(p => p.baseName)))
    .catch(error => {
      console.warn('[notifications] boot reconcile failed', error);
    });
}
