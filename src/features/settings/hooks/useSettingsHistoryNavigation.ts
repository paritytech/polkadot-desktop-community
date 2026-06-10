import { useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';

import { useRxState } from '@/shared/rxstate';
import {
  type SettingsHistory,
  canGoBack as canGoBackFn,
  canGoForward as canGoForwardFn,
  getCurrentEntry,
  goBack as goBackReducer,
  goForward as goForwardReducer,
  settingsHistory$,
} from '../state/history';

export const useSettingsHistoryNavigation = () => {
  const router = useRouter();
  const [history] = useRxState(settingsHistory$);

  const canGoBack = canGoBackFn(history);
  const canGoForward = canGoForwardFn(history);

  const applyNavigation = useCallback(
    (reducer: (h: SettingsHistory) => SettingsHistory) => {
      const next = reducer(history);
      if (next === history) return;

      const target = getCurrentEntry(next);
      if (!target) return;

      settingsHistory$.set(next);
      router.history.push(target);
    },
    [history, router],
  );

  const goBack = useCallback(() => applyNavigation(goBackReducer), [applyNavigation]);
  const goForward = useCallback(() => applyNavigation(goForwardReducer), [applyNavigation]);

  return { canGoBack, canGoForward, goBack, goForward };
};
