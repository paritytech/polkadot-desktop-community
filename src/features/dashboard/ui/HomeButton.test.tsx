// @vitest-environment happy-dom

import 'fake-indexeddb/auto';

import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { TranslationProvider } from '@/shared/translation';
import { DASHBOARD_TAB_ID, browserTabs } from '@/aggregates/browser-tabs';

import { HomeButton } from './HomeButton';

async function renderHomeButton() {
  const rootRoute = createRootRoute({
    component: () => (
      <TranslationProvider>
        <HomeButton />
      </TranslationProvider>
    ),
  });
  const dashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/dashboard' });
  const router = createRouter({
    routeTree: rootRoute.addChildren([dashboardRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  await router.load();

  render(<RouterProvider router={router} />);

  return router;
}

describe('HomeButton', () => {
  it('selects the dashboard tab and then navigates to the dashboard', async () => {
    const user = userEvent.setup();
    browserTabs.addTab({ id: 'chat', type: 'chat', deeplink: '' }, { persistable: true });
    const router = await renderHomeButton();

    const selectedWhenNavigationStarted: Nullable<string>[] = [];
    router.subscribe('onBeforeNavigate', () => selectedWhenNavigationStarted.push(browserTabs.selectedTabId$.get()));

    await user.click(await screen.findByRole('button', { name: 'Home' }));

    expect(selectedWhenNavigationStarted).toEqual([DASHBOARD_TAB_ID]);
    expect(router.state.location.pathname).toBe('/dashboard');
    expect(browserTabs.selectedTabId$.get()).toBe(DASHBOARD_TAB_ID);
  });
});
