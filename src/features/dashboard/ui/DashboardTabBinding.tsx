import { useLocation } from '@tanstack/react-router';
import { useEffect } from 'react';

import { useRxState } from '@/shared/rxstate';
import { pathnameMatchesSegment } from '@/shared/utils';
import { browserTabs, dashboardUseCase } from '@/aggregates/browser-tabs';

export const DashboardTabBinding = () => {
  const location = useLocation();
  const [tabs] = useRxState(browserTabs.tabs$);
  const onDashboardRoute = pathnameMatchesSegment(location.pathname, '/dashboard');

  useEffect(() => {
    dashboardUseCase.cleanupOrphanDashboardTab();
  }, [tabs]);

  // Sync route → dashboard tab only when entering /dashboard. Do not depend on `tabs`:
  // adding a new-tab while still on /dashboard would re-select dashboard and block
  // BrowserTabBinding from navigating to /new-tab/$id.
  useEffect(() => {
    if (!onDashboardRoute) return;
    dashboardUseCase.selectDashboardTab();
  }, [onDashboardRoute]);

  return null;
};
