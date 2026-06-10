import { GenericError, PushNotificationError } from '@novasamatech/host-api';
import { type Container } from '@novasamatech/host-container';
import { useNavigate } from '@tanstack/react-router';
import { fromPromise } from 'neverthrow';
import { useEffect } from 'react';

import { useLooseRef } from '@/shared/hooks';
import { createDefaultRateLimiter } from '@/shared/rateLimiter';
import { useTranslation } from '@/shared/translation';
import { toError } from '@/shared/utils';
import { useDisplayedProduct } from '@/domains/product';

import { createOnRateLimited } from './_helpers';

export function useNotifications(container: Container, identifier: string) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const tRef = useLooseRef(t);
  const { data: product } = useDisplayedProduct(identifier);
  const productRef = useLooseRef(product);
  const navigateRef = useLooseRef(navigate);

  useEffect(() => {
    const getProductName = () => productRef()?.baseName ?? identifier;
    const rateLimiterPush = createDefaultRateLimiter({
      onRateLimited: createOnRateLimited(identifier, getProductName, 'pushNotification', tRef()),
      mapErr: reason => new PushNotificationError.Unknown({ reason }),
    });
    const rateLimiterCancel = createDefaultRateLimiter({
      onRateLimited: createOnRateLimited(identifier, getProductName, 'pushNotificationCancel', tRef()),
      mapErr: reason => new GenericError({ reason }),
    });

    const offActivated = window.App.onNotificationActivated(({ productId, deeplink }) => {
      if (productId !== identifier) return;
      window.App.focusWindow();
      navigateRef()({
        to: '/product/$id/{-$route}',
        params: { id: identifier, route: deeplink ?? undefined },
      });
    });

    const cleanupPushNotification = container.handlePushNotification(({ text, deeplink, scheduledAt }, { ok, err }) =>
      rateLimiterPush.schedule(() => {
        const productName = productRef()?.baseName ?? identifier;
        const sanitizedText = text.trim().slice(0, 200);

        return fromPromise(
          window.App.scheduleNotification({
            productId: identifier,
            title: productName,
            text: sanitizedText,
            deeplink: deeplink ?? null,
            // Past or absent scheduledAt → immediate fire; main short-circuits the persisted queue.
            scheduledAt: scheduledAt !== undefined ? Number(scheduledAt) : null,
          }),
          e => new PushNotificationError.Unknown({ reason: toError(e).message }),
        ).andThen(result => {
          if (result.ok) return ok(result.id);
          if (result.error === 'ScheduleLimitReached') return err(new PushNotificationError.ScheduleLimitReached());
          return err(new PushNotificationError.Unknown({ reason: result.reason ?? 'Unknown error' }));
        });
      }),
    );

    const cleanupPushNotificationCancel = container.handlePushNotificationCancel((id, { ok }) =>
      rateLimiterCancel.schedule(() =>
        fromPromise(window.App.cancelNotification(identifier, id), e => new GenericError({ reason: toError(e).message })).andThen(
          () => ok(undefined),
        ),
      ),
    );

    return () => {
      cleanupPushNotification();
      cleanupPushNotificationCancel();
      offActivated();
      rateLimiterPush.destroy();
      rateLimiterCancel.destroy();
    };
  }, [container, identifier]);
}
