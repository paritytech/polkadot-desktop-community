import { type DataTable } from '@cucumber/cucumber';
import { createBdd } from 'playwright-bdd';

import { authenticatedTest } from '../fixtures/authenticated';
import { BrowserPage } from '../page-objects/BrowserPage';

const { Given, When, Then } = createBdd(authenticatedTest);

Given('no product tabs are open', async ({ authenticatedApp }) => {
  const browser = new BrowserPage(authenticatedApp.window, authenticatedApp.app);
  await browser.closeAllTabs();
});

When('the user opens products in new tabs:', async ({ authenticatedApp }, products: DataTable) => {
  const browser = new BrowserPage(authenticatedApp.window, authenticatedApp.app);

  for (const [domain] of products.rows()) {
    await browser.openProductInNewTab(domain);

    // Let the product start loading before opening the next tab
    await authenticatedApp.window.waitForTimeout(3_000);
  }
});

When('the user cycles through all tabs', async ({ authenticatedApp }) => {
  const browser = new BrowserPage(authenticatedApp.window, authenticatedApp.app);
  await browser.cycleThroughAllTabs();
});

Then('every tab has loaded content', async ({ authenticatedApp }) => {
  const browser = new BrowserPage(authenticatedApp.window, authenticatedApp.app);
  await browser.expectAllTabsHaveContent();
});
