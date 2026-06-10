import { pathnameMatchesSegment } from '@/shared/utils';

import { browserTabs } from './state/tabs';

import { router } from '@/router';

const SYSTEM_TAB_ROUTES: Record<string, '/chat/{-$chatId}' | '/settings' | '/dashboard'> = {
  chat: '/chat/{-$chatId}',
  settings: '/settings',
  dashboard: '/dashboard',
};

export const isSystemTabType = (tabType: string): boolean => tabType in SYSTEM_TAB_ROUTES;

const routeSegmentForTabType = (tabType: string): string => `/${tabType}`;

/** Navigates to the route for the currently selected system tab (chat/settings/dashboard). */
const syncRouteToSelectedTab = (): void => {
  const selectedId = browserTabs.selectedTabId$.get();
  if (selectedId === null) return;

  const tab = browserTabs.tabs$.get().find(t => t.id === selectedId);
  if (!tab) return;

  const to = SYSTEM_TAB_ROUTES[tab.type];
  if (!to) return;

  const pathname = router.state.location.pathname;
  if (pathnameMatchesSegment(pathname, routeSegmentForTabType(tab.type))) return;

  void router.navigate({ to });
};

/** When all tabs are closed, leave feature routes and show the dashboard home. */
const navigateHomeWhenNoTabs = (): void => {
  if (browserTabs.tabs$.get().length > 0) return;

  const pathname = router.state.location.pathname;
  if (pathnameMatchesSegment(pathname, '/dashboard')) return;

  void router.navigate({ to: '/dashboard' });
};

export const navigationUseCase = {
  syncRouteToSelectedTab,
  navigateHomeWhenNoTabs,
};
