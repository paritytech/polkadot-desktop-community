import { createBdd } from 'playwright-bdd';

import { authenticatedTest, expect } from '../fixtures/authenticated';
import { DEFAULT_TIMEOUT } from '../helpers/timeouts';
import { AppearancePage } from '../page-objects/AppearancePage';
import { DashboardPage } from '../page-objects/DashboardPage';

const { When, Then } = createBdd(authenticatedTest);

When('the user toggles the theme to dark', async ({ authenticatedApp }) => {
  const dashboard = new DashboardPage(authenticatedApp.window);
  await dashboard.setTheme('Night');
  await authenticatedApp.window.waitForTimeout(500);
});

When('the user opens the appearance settings', async ({ authenticatedApp }) => {
  const dashboard = new DashboardPage(authenticatedApp.window);
  await dashboard.openSettings();
  await authenticatedApp.window.waitForURL(/settings/, { timeout: DEFAULT_TIMEOUT });
  const appearanceLink = authenticatedApp.window.getByRole('link', { name: 'Appearance', exact: true });
  await expect(appearanceLink).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await appearanceLink.click();
});

Then('the color mode options Device, Day and Night are available', async ({ authenticatedApp }) => {
  await new AppearancePage(authenticatedApp.window).expectColorModesVisible(['Device', 'Day', 'Night']);
});

When('the user selects the {string} color mode', async ({ authenticatedApp }, name: string) => {
  await new AppearancePage(authenticatedApp.window).selectColorMode(name);
});

Then('the {string} color mode is selected', async ({ authenticatedApp }, name: string) => {
  await new AppearancePage(authenticatedApp.window).expectColorModeSelected(name);
});

Then('the authenticated dashboard screenshot is taken as {string}', async ({ authenticatedApp, $testInfo }, name: string) => {
  const dashboard = new DashboardPage(authenticatedApp.window);
  await dashboard.takeScreenshot($testInfo, `${name}-${process.platform}`);
});
