import { type Container } from '@novasamatech/host-container';
import { useEffect } from 'react';

import { useLooseRef, useSubscription } from '@/shared/hooks';
import { type Locale, useLocalePreference } from '@/shared/translation';

import { createSubscriptionScope } from './_helpers';

export function useLocale(container: Container) {
  const locale = useLocalePreference();
  const localeRef = useLooseRef<Locale>(locale);
  const subscribeLocale = useSubscription(locale);

  useEffect(() => {
    const subscriptions = createSubscriptionScope();

    const cleanupSubscribe = container.handleLocaleSubscribe((_, send) => {
      send({ languageTag: localeRef() });
      return subscriptions.track(
        subscribeLocale(() => {
          if (subscriptions.disposed) return;
          send({ languageTag: localeRef() });
        }),
      );
    });

    return () => {
      subscriptions.dispose();
      cleanupSubscribe();
    };
  }, [container]);
}
