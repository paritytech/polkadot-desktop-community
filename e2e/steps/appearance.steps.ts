import { createBdd } from 'playwright-bdd';

import { authenticatedTest } from '../fixtures/authenticated';
import { DashboardPage } from '../page-objects/DashboardPage';

const { When, Then } = createBdd(authenticatedTest);

When('the user toggles the theme to dark', async ({ authenticatedApp }) => {
  const dashboard = new DashboardPage(authenticatedApp.window);
  await dashboard.setTheme('Dark');
  await authenticatedApp.window.waitForTimeout(500);
});

Then(
  'the authenticated dashboard screenshot is taken as {string}',
  async ({ authenticatedApp, $testInfo }, name: string) => {
    const dashboard = new DashboardPage(authenticatedApp.window);
    await dashboard.takeScreenshot($testInfo, `${name}-${process.platform}`);
  },
);
