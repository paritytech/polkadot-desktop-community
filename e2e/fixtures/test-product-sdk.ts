import { TestProductPage } from '../page-objects/TestProductPage';

import { authenticatedTest } from './authenticated';

/**
 * Extended authenticated test with a shared TestProductPage fixture.
 * Used by all host-playground feature files (Accounts, Signing, Storage, etc.).
 * The TestProductPage instance persists across steps within a single test,
 * keeping the webview page reference alive.
 */
export const test = authenticatedTest.extend<{ testProductPage: TestProductPage }>({
  testProductPage: async ({ authenticatedApp }, use) => {
    const page = new TestProductPage(authenticatedApp.window, authenticatedApp.app);
    await use(page);
  },
});

export { expect } from '@playwright/test';
