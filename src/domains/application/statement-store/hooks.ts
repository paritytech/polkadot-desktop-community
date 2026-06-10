import { NoAllowanceError } from '@novasamatech/statement-store';
import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/shared/translation';

import { submitError$ } from './service';

export type SubmitErrorInfo = {
  title: string;
  description: string;
};

/**
 * Subscribes to statement-store submit errors.
 * Returns mapped error info while `enabled` is `true`, resets on disable.
 * Known errors get user-friendly translations, unknown ones show the raw message.
 */
export const useSubmitError = (enabled: boolean) => {
  const { t } = useTranslation();
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) {
      setError(null);

      return;
    }

    const subscription = submitError$.subscribe(setError);

    return () => subscription.unsubscribe();
  }, [enabled]);

  const mapError = useCallback(
    (e: Error): SubmitErrorInfo => {
      if (e instanceof NoAllowanceError) {
        return {
          title: t('feature.browser.noAllowanceErrorTitle'),
          description: t('feature.browser.noAllowanceErrorDescription'),
        };
      }

      return {
        title: t('feature.browser.statementStoreErrorTitle'),
        description: e.message,
      };
    },
    [t],
  );

  return error ? mapError(error) : null;
};
