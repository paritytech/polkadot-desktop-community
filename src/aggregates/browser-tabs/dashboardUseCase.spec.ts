// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';

import { DASHBOARD_TAB_ID } from './constants';
import { dashboardUseCase } from './dashboardUseCase';
import { browserTabs } from './state/tabs';

beforeEach(() => {
  browserTabs.tabs$.set([]);
  browserTabs.selectedTabId$.set(null);
});

describe('cleanupOrphanDashboardTab', () => {
  it('removes dashboard when it is the only tab', () => {
    browserTabs.addTab({ id: DASHBOARD_TAB_ID, type: DASHBOARD_TAB_ID, deeplink: '' }, { persistable: true });
    browserTabs.selectTab(DASHBOARD_TAB_ID);

    dashboardUseCase.cleanupOrphanDashboardTab();

    expect(browserTabs.tabs$.get()).toEqual([]);
    expect(browserTabs.selectedTabId$.get()).toBeNull();
  });

  it('keeps dashboard when other tabs exist', () => {
    browserTabs.addTab({ id: 'chat', type: 'chat', deeplink: '' }, { persistable: true });
    browserTabs.addTab({ id: DASHBOARD_TAB_ID, type: DASHBOARD_TAB_ID, deeplink: '' }, { persistable: true });

    dashboardUseCase.cleanupOrphanDashboardTab();

    expect(browserTabs.tabs$.get()).toHaveLength(2);
  });
});

describe('ensureDashboardTabExists', () => {
  it('adds dashboard tab when other tabs are open', () => {
    browserTabs.addTab({ id: 'chat', type: 'chat', deeplink: '' }, { persistable: true });

    dashboardUseCase.ensureDashboardTabExists();

    expect(browserTabs.tabs$.get().some(t => t.id === DASHBOARD_TAB_ID)).toBe(true);
  });

  it('does not add dashboard tab when no other tabs exist', () => {
    dashboardUseCase.ensureDashboardTabExists();

    expect(browserTabs.tabs$.get()).toEqual([]);
  });
});

describe('selectDashboardTab', () => {
  it('selects dashboard when it exists alongside other tabs', () => {
    browserTabs.addTab({ id: 'chat', type: 'chat', deeplink: '' }, { persistable: true });
    browserTabs.addTab({ id: DASHBOARD_TAB_ID, type: DASHBOARD_TAB_ID, deeplink: '' }, { persistable: true });
    browserTabs.selectTab('chat');

    dashboardUseCase.selectDashboardTab();

    expect(browserTabs.selectedTabId$.get()).toBe(DASHBOARD_TAB_ID);
  });

  it('creates dashboard tab and selects it when other tabs exist', () => {
    browserTabs.addTab({ id: 'chat', type: 'chat', deeplink: '' }, { persistable: true });
    browserTabs.selectTab('chat');

    dashboardUseCase.selectDashboardTab();

    expect(browserTabs.tabs$.get().some(t => t.id === DASHBOARD_TAB_ID)).toBe(true);
    expect(browserTabs.selectedTabId$.get()).toBe(DASHBOARD_TAB_ID);
  });

  it('clears selection when there are no tabs', () => {
    browserTabs.selectTab('chat');

    dashboardUseCase.selectDashboardTab();

    expect(browserTabs.selectedTabId$.get()).toBeNull();
  });
});
