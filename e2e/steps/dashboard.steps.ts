import { createBdd } from 'playwright-bdd';

import { expect, test } from '../fixtures/base';
import { setFullScreen } from '../helpers/electron';
import { DashboardPage } from '../page-objects/DashboardPage';

const { When, Then } = createBdd(test);

Then('the dashboard is displayed', async ({ electronApp }) => {
  const dashboard = new DashboardPage(electronApp.window);
  await dashboard.waitForDashboard();
});

When('the user enters fullscreen mode', async ({ electronApp }) => {
  // setFullScreen already awaits the enter-full-screen OS event — no extra sleep needed
  await setFullScreen(electronApp.app, true);
});

Then('the dashboard is displayed in fullscreen', async ({ electronApp }) => {
  const isFullscreen = await electronApp.app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];

    return win?.isFullScreen() ?? false;
  });

  expect(isFullscreen).toBe(true);

  // Leave fullscreen — setFullScreen awaits the leave-full-screen OS event
  await setFullScreen(electronApp.app, false);
});

When('the user opens quick chat', async ({ electronApp }) => {
  const dashboard = new DashboardPage(electronApp.window);
  await dashboard.openQuickChat();
});

When('the user opens settings', async ({ electronApp }) => {
  const dashboard = new DashboardPage(electronApp.window);
  await dashboard.openSettings();
});

When('the user opens user card', async ({ electronApp }) => {
  const dashboard = new DashboardPage(electronApp.window);
  await dashboard.clickUserButton();
});

Then('the dashboard screenshot is taken as {string}', async ({ electronApp, $testInfo }, name: string) => {
  const dashboard = new DashboardPage(electronApp.window);
  await dashboard.takeScreenshot($testInfo, `${name}-${process.platform}`);
});
