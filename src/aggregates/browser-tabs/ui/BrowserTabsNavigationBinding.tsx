import { useEffect } from 'react';

import { useRxState } from '@/shared/rxstate';
import { navigationUseCase } from '../navigationUseCase';
import { browserTabs } from '../state/tabs';

/** Single selection→route subscriber for system tabs (chat/settings/dashboard). */
export const BrowserTabsNavigationBinding = () => {
  const [selectedId] = useRxState(browserTabs.selectedTabId$);
  const [tabs] = useRxState(browserTabs.tabs$);

  useEffect(() => {
    navigationUseCase.syncRouteToSelectedTab();
  }, [selectedId]);

  useEffect(() => {
    navigationUseCase.navigateHomeWhenNoTabs();
  }, [tabs]);

  return null;
};
