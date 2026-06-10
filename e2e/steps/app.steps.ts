import { createBdd } from 'playwright-bdd';

import { expect, test } from '../fixtures/base';
import { getAppName, getAppVersion } from '../helpers/electron';
import { DEFAULT_TIMEOUT } from '../helpers/timeouts';
import { waitForIdle } from '../helpers/wait';

const { Given, Then } = createBdd(test);

Given('the app is launched', async ({ electronApp }) => {
  await waitForIdle(electronApp.window);
});

Given('the app is launched in autotest mode', async ({ electronApp }) => {
  // The autotest fixture is set to true via project config use: { autotest: true }
  // Wait for the SPA to render the onboarding screen
  await electronApp.window.waitForLoadState('domcontentloaded');
  await electronApp.window.locator('body').waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
});

Then('the app window is visible', async ({ electronApp }) => {
  await expect(electronApp.window.locator('body')).toBeVisible();
});

Then('the app name is defined', async ({ electronApp }) => {
  const name = await getAppName(electronApp.app);
  expect(name).toBeTruthy();
});

Then('the app version is defined', async ({ electronApp }) => {
  const version = await getAppVersion(electronApp.app);
  expect(version).toBeTruthy();
});

Then('the window title is not empty', async ({ electronApp }) => {
  const title = await electronApp.window.title();
  expect(title).toBeTruthy();
});

Then('the window width is greater than {int}', async ({ electronApp }, min: number) => {
  const viewportSize = electronApp.window.viewportSize();
  const width = viewportSize ? viewportSize.width : await electronApp.window.evaluate(() => globalThis.innerWidth);

  expect(width).toBeGreaterThan(min);
});

Then('the window height is greater than {int}', async ({ electronApp }, min: number) => {
  const viewportSize = electronApp.window.viewportSize();
  const height = viewportSize ? viewportSize.height : await electronApp.window.evaluate(() => globalThis.innerHeight);

  expect(height).toBeGreaterThan(min);
});

Then('a screenshot can be captured', async ({ electronApp }) => {
  const screenshot = await electronApp.window.screenshot();
  expect(screenshot).toBeTruthy();
  expect(screenshot.length).toBeGreaterThan(0);
});
