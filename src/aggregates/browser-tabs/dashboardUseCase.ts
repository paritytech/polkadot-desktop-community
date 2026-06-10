import { DASHBOARD_TAB_ID } from './constants';
import { type Tab, type TabRef, browserTabs } from './state/tabs';

const dashboardTabRef: TabRef = { id: DASHBOARD_TAB_ID, type: DASHBOARD_TAB_ID, deeplink: '' };

const getDashboardTabLayout = (tabs: Tab[]): { hasDashboard: boolean; hasOther: boolean } => ({
  hasDashboard: tabs.some(t => t.id === DASHBOARD_TAB_ID),
  hasOther: tabs.some(t => t.id !== DASHBOARD_TAB_ID),
});

/** Removes a dashboard tab when it is the only tab left (on any route). */
const cleanupOrphanDashboardTab = (): void => {
  const { hasDashboard, hasOther } = getDashboardTabLayout(browserTabs.tabs$.get());
  if (!hasDashboard || hasOther) return;

  browserTabs.removeTab(DASHBOARD_TAB_ID);
  if (browserTabs.selectedTabId$.get() === DASHBOARD_TAB_ID) {
    browserTabs.selectTab(null);
  }
};

/** Ensures the dashboard tab exists when at least one other tab is open. */
const ensureDashboardTabExists = (): void => {
  const tabs = browserTabs.tabs$.get();
  const { hasDashboard, hasOther } = getDashboardTabLayout(tabs);
  if (!hasOther || hasDashboard) return;

  browserTabs.addTab(dashboardTabRef, { persistable: true, prepend: true });
};

/** Materialize dashboard tab if needed, then select it (or clear selection). */
const selectDashboardTab = (): void => {
  ensureDashboardTabExists();

  const { hasDashboard } = getDashboardTabLayout(browserTabs.tabs$.get());
  if (hasDashboard) {
    browserTabs.selectTab(DASHBOARD_TAB_ID);
    return;
  }

  browserTabs.selectTab(null);
};

export const dashboardUseCase = {
  cleanupOrphanDashboardTab,
  ensureDashboardTabExists,
  selectDashboardTab,
};
