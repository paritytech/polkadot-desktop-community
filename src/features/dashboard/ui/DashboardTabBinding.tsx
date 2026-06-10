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

  useEffect(() => {
    if (!onDashboardRoute) return;
    dashboardUseCase.selectDashboardTab();
  }, [onDashboardRoute, tabs]);

  return null;
};
