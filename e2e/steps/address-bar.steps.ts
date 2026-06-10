import { type DataTable } from '@cucumber/cucumber';
import { type Page } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

import { expect, test } from '../fixtures/base';
import { DEFAULT_TIMEOUT } from '../helpers/timeouts';
import { BrowserPage } from '../page-objects/BrowserPage';
import { DashboardPage } from '../page-objects/DashboardPage';

const { Then } = createBdd(test);

Then('the address bar survives the following inputs:', async ({ electronApp }, inputs: DataTable) => {
  const browser = new BrowserPage(electronApp.window, electronApp.app);
  const dashboard = new DashboardPage(electronApp.window);

  // Skip the header row (column name).
  const rows = inputs.rows();
  const baselineTabs = await browser.tabs.count();

  for (const [input] of rows) {
    await browser.addressBar.click();
    await browser.addressBar.fill(input);
    await browser.addressBar.press('Enter');

    // Responsiveness check: if the renderer crashed, these will fail.
    // DEFAULT_TIMEOUT covers any processing delay — no fixed sleep needed.
    await expect(browser.addressBar, `crashed after input: ${JSON.stringify(input)}`).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
    await expect(dashboard.userButton, `top bar gone after input: ${JSON.stringify(input)}`).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });

    // Close any tabs the input happened to open so the next iteration
    // starts from the same baseline.
    await closeExtraTabs(electronApp.window, baselineTabs);
  }
});

async function closeExtraTabs(window: Page, baseline: number) {
  const closeButtons = window.getByRole('button', { name: 'Close tab' });

  // Close from the end so DOM indices stay stable.
  for (let safety = 0; safety < 20; safety++) {
    const tabCount = await window.locator('[data-tab-id]').count();
    if (tabCount <= baseline) return;

    const count = await closeButtons.count();
    if (count === 0) return;

    await closeButtons.last().click({ force: true });
  }
}
