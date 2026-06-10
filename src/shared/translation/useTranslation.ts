import { useCallback } from 'react';
import { useIntl } from 'react-intl';

export const useTranslation = () => {
  const intl = useIntl();

  // Memoize so `t` is referentially stable across renders (it only changes when
  // `intl` does, i.e. on locale/messages change). An unstable `t` is a footgun
  // in effect/useCallback/useMemo dependency arrays: it would re-run them on
  // every render of the consuming component.
  const t = useCallback((id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values), [intl]);

  return { t, locale: intl.locale };
};
