import { LoginErr } from '@novasamatech/host-api';
import { type Container } from '@novasamatech/host-container';
import { useSession } from '@novasamatech/host-papp-react-ui';
import { useNavigate } from '@tanstack/react-router';
import { ResultAsync } from 'neverthrow';
import { useEffect } from 'react';

import { useLooseRef, useSubscription } from '@/shared/hooks';
import { createDefaultRateLimiter } from '@/shared/rateLimiter';
import { useTranslation } from '@/shared/translation';
import { useDisplayedProduct } from '@/domains/product';

import { createOnRateLimited } from './_helpers';

export function useLogin(container: Container, identifier: string) {
  const navigate = useNavigate();
  const navigateRef = useLooseRef(navigate);
  const { t } = useTranslation();
  const tRef = useLooseRef(t);
  const { data: product } = useDisplayedProduct(identifier);
  const productRef = useLooseRef(product);
  const { session } = useSession();
  const sessionRef = useLooseRef(session);
  const subscribeSession = useSubscription(session);

  useEffect(() => {
    const getProductName = () => productRef()?.baseName ?? identifier;
    const rateLimiterRequestLogin = createDefaultRateLimiter({
      onRateLimited: createOnRateLimited(identifier, getProductName, 'login', tRef()),
      mapErr: reason => new LoginErr.Unknown({ reason }),
    });

    const pendingResolvers = new Set<(result: 'success' | 'alreadyConnected' | 'rejected') => void>();
    const unsubscribeFromSession = subscribeSession(next => {
      if (!next) return;
      for (const resolve of pendingResolvers) {
        resolve('success');
      }
      pendingResolvers.clear();
    });

    container.handleRequestLogin((_reason, { ok }) =>
      rateLimiterRequestLogin.schedule(() => {
        if (sessionRef()) {
          return ok('alreadyConnected');
        }

        void navigateRef()({ to: '/onboarding' });

        return ResultAsync.fromSafePromise(
          new Promise<'success' | 'alreadyConnected' | 'rejected'>(resolve => {
            pendingResolvers.add(resolve);
          }),
        ).andThen(result => ok(result));
      }),
    );

    return () => {
      unsubscribeFromSession();
      for (const resolve of pendingResolvers) {
        resolve('rejected');
      }
      pendingResolvers.clear();
      rateLimiterRequestLogin.destroy();
    };
  }, [container, identifier]);
}
