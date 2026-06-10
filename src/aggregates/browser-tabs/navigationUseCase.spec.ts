// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isSystemTabType, navigationUseCase } from './navigationUseCase';
import { browserTabs } from './state/tabs';

const navigateMock = vi.fn();

vi.mock('@/router', () => ({
  router: {
    state: { location: { pathname: '/chat' } },
    navigate: (...args: unknown[]) => navigateMock(...args),
  },
}));

beforeEach(() => {
  browserTabs.tabs$.set([]);
  browserTabs.selectedTabId$.set(null);
  navigateMock.mockClear();
});

describe('isSystemTabType', () => {
  it('returns true for chat, settings, and dashboard', () => {
    expect(isSystemTabType('chat')).toBe(true);
    expect(isSystemTabType('settings')).toBe(true);
    expect(isSystemTabType('dashboard')).toBe(true);
  });

  it('returns false for product and new-tab tabs', () => {
    expect(isSystemTabType('product')).toBe(false);
    expect(isSystemTabType('new-tab')).toBe(false);
  });
});

describe('syncRouteToSelectedTab', () => {
  it('navigates to dashboard when dashboard tab is selected off-route', async () => {
    const { router } = await import('@/router');
    router.state.location.pathname = '/chat';
    browserTabs.addTab({ id: 'dashboard', type: 'dashboard', deeplink: '' }, { persistable: true });
    browserTabs.selectTab('dashboard');

    navigationUseCase.syncRouteToSelectedTab();

    expect(navigateMock).toHaveBeenCalledWith({ to: '/dashboard' });
  });

  it('skips navigation when already on the tab route', async () => {
    const { router } = await import('@/router');
    router.state.location.pathname = '/chat';
    browserTabs.addTab({ id: 'chat', type: 'chat', deeplink: '' }, { persistable: true });
    browserTabs.selectTab('chat');

    navigationUseCase.syncRouteToSelectedTab();

    expect(navigateMock).not.toHaveBeenCalled();
  });
});

describe('navigateHomeWhenNoTabs', () => {
  it('navigates to dashboard when tabs are empty on a feature route', async () => {
    const { router } = await import('@/router');
    router.state.location.pathname = '/chat';

    navigationUseCase.navigateHomeWhenNoTabs();

    expect(navigateMock).toHaveBeenCalledWith({ to: '/dashboard' });
  });

  it('skips navigation when already on dashboard', async () => {
    const { router } = await import('@/router');
    router.state.location.pathname = '/dashboard';

    navigationUseCase.navigateHomeWhenNoTabs();

    expect(navigateMock).not.toHaveBeenCalled();
  });
});
