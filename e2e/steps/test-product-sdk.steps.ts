import { createBdd } from 'playwright-bdd';

import { test } from '../fixtures/test-product-sdk';

const { Given, When, Then } = createBdd(test);

Given('the test product {string} is opened', async ({ testProductPage }, productName: string) => {
  await testProductPage.navigateTo(productName);
  await testProductPage.waitForProductReady();
});

When('the user clicks the {string} tab', async ({ testProductPage }, tabName: string) => {
  await testProductPage.clickCategory(tabName);
});

When('the user runs {string}', async ({ testProductPage }, actionName: string) => {
  await testProductPage.runAction(actionName);
});

When('the user reloads the product', async ({ testProductPage }) => {
  await testProductPage.reloadProduct();
});

When('the user confirms signing', async ({ testProductPage }) => {
  await testProductPage.confirmSigning();
});

Then('the result contains {string}', async ({ testProductPage, $testInfo }, expectedText: string) => {
  try {
    await testProductPage.expectResultContains(expectedText);
  } catch (err) {
    const diagnostics = await testProductPage.collectWebviewDiagnostics();
    await $testInfo.attach('webview-body-text.txt', {
      body: diagnostics.bodyText,
      contentType: 'text/plain',
    });
    if (diagnostics.screenshot) {
      await $testInfo.attach('webview-screenshot.png', {
        body: diagnostics.screenshot,
        contentType: 'image/png',
      });
    }
    throw err;
  }
});
