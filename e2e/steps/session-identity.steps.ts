import { createBdd } from 'playwright-bdd';

import { expect, test } from '../fixtures/base';
import { DEFAULT_TIMEOUT } from '../helpers/timeouts';
import { DashboardPage } from '../page-objects/DashboardPage';

const { Then } = createBdd(test);

// --- TC-2.4.3 ---------------------------------------------------------------

Then('the user button offers to connect an account', async ({ electronApp }) => {
  const dashboard = new DashboardPage(electronApp.window);
  await expect(dashboard.userButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await dashboard.expectSignedOut();
});
