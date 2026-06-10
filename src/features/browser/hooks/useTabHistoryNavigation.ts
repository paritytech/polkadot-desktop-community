import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

import { useRxState } from '@/shared/rxstate';
import { type TabRef, browserTabs } from '@/aggregates/browser-tabs';
import {
  type TabHistory,
  canGoBack as canGoBackFn,
  canGoForward as canGoForwardFn,
  getCurrentEntry,
  goBack as goBackReducer,
  goForward as goForwardReducer,
  tabHistories$,
} from '../state/history';
import { toBrowserNavigation } from '../tabs/helpers';

export const useTabHistoryNavigation = () => {
  const navigate = useNavigate();
  const [tabs] = useRxState(browserTabs.tabs$);
  const [selectedTabId] = useRxState(browserTabs.selectedTabId$);
  const [histories] = useRxState(tabHistories$);

  const tabKey = selectedTabId ? browserTabs.findTabKey(tabs, selectedTabId) : null;
  const history = tabKey ? histories[tabKey] : undefined;

  const canGoBack = canGoBackFn(history);
  const canGoForward = canGoForwardFn(history);

  const applyNavigation = useCallback(
    (reducer: (h: TabHistory | undefined) => TabHistory | undefined) => {
      if (!tabKey || !selectedTabId) return;
      const nextHistory = reducer(history);
      if (!nextHistory || nextHistory === history) return;
      const target: TabRef | null = getCurrentEntry(nextHistory);
      if (!target) return;
      browserTabs.replaceTabIdentifier(selectedTabId, target, { persistable: true });
      tabHistories$.set(prev => ({ ...prev, [tabKey]: nextHistory }));
      void navigate(toBrowserNavigation(target));
    },
    [tabKey, selectedTabId, history, navigate],
  );

  const goBack = useCallback(() => applyNavigation(goBackReducer), [applyNavigation]);
  const goForward = useCallback(() => applyNavigation(goForwardReducer), [applyNavigation]);

  return { canGoBack, canGoForward, goBack, goForward };
};
