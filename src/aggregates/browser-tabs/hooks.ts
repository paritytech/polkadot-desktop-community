import { useLocation } from '@tanstack/react-router';
import { useLayoutEffect } from 'react';

import { pathnameMatchesSegment } from '@/shared/utils';

import { type TabRef, browserTabs } from './state/tabs';

type TabRouteBindingOptions = {
  segment: string;
  tab: TabRef;
  touchAlive?: boolean;
};

/** Route → tab: materialize the tab and select it when the user is on `segment`. */
export const useTabRouteBinding = ({ segment, tab, touchAlive = false }: TabRouteBindingOptions): void => {
  const location = useLocation();
  const onRoute = pathnameMatchesSegment(location.pathname, segment);

  useLayoutEffect(() => {
    if (!onRoute) return;
    browserTabs.addTab(tab, { persistable: true });
    if (touchAlive) browserTabs.touchAliveTabId(tab.id);
    browserTabs.selectTab(tab.id);
  }, [onRoute, segment, tab.id, tab.type, tab.deeplink, touchAlive]);
};
