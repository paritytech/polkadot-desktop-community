import { createBdd } from 'playwright-bdd';

import { authenticatedTest } from '../fixtures/authenticated';
import { BrowserPage } from '../page-objects/BrowserPage';
import { ProductActionsPage } from '../page-objects/ProductActionsPage';

const { Given, When, Then } = createBdd(authenticatedTest);

Given('the user opens {string} in a new tab', async ({ authenticatedApp }, domain: string) => {
  const browser = new BrowserPage(authenticatedApp.window, authenticatedApp.app);
  await browser.openProductInNewTab(domain);
});

When('the user opens the product actions menu', async ({ authenticatedApp }) => {
  const productActions = new ProductActionsPage(authenticatedApp.window);
  await productActions.openMenu();
});

When('the user selects {string}', async ({ authenticatedApp }, itemLabel: string) => {
  // Route to the correct menu item based on label
  const productActions = new ProductActionsPage(authenticatedApp.window);

  if (itemLabel === 'Enable offline access') {
    await productActions.clickOfflineAccessMenuItem();
  } else {
    throw new Error(`Unknown menu item: "${itemLabel}"`);
  }
});

When('the user confirms the offline access dialog', async ({ authenticatedApp }) => {
  const productActions = new ProductActionsPage(authenticatedApp.window);
  await productActions.confirmEnableOfflineAccess();
});

Then('the pin indicator appears next to the product address', async ({ authenticatedApp }) => {
  const productActions = new ProductActionsPage(authenticatedApp.window);
  await productActions.expectPinIndicatorVisible();
});
