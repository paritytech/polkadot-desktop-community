import { useEffect } from 'react';

import { useRxState } from '@/shared/rxstate';
import { userIdentity$ } from '@/domains/sso';
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

  useEffect(() => {
    let hadIdentity = userIdentity$.get() !== null;

    const subscription = userIdentity$.value$.subscribe(identity => {
      if (hadIdentity && identity === null) {
        browserTabs.selectTab(null);
      }
      hadIdentity = identity !== null;
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
};
