import { type Page, expect } from '@playwright/test';

import { TEST_IDS } from '@/shared/test-ids';
import { DEFAULT_TIMEOUT } from '../helpers/timeouts';

/**
 * Page Object for the product actions menu (•••) and its items,
 * including "Enable offline access".
 */
export class ProductActionsPage {
  constructor(private readonly page: Page) {}

  get menuTrigger() {
    return this.page.getByTestId(TEST_IDS.productActionsMenuTrigger);
  }

  get offlineAccessMenuItem() {
    return this.page.getByTestId(TEST_IDS.offlineAccessMenuItem);
  }

  get offlineAccessEnableConfirm() {
    return this.page.getByTestId(TEST_IDS.offlineAccessEnableConfirm);
  }

  get offlineAccessPinIndicator() {
    return this.page.getByTestId(TEST_IDS.offlineAccessPinIndicator);
  }

  async openMenu() {
    await expect(this.menuTrigger).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await this.menuTrigger.click();
  }

  async clickOfflineAccessMenuItem() {
    await expect(this.offlineAccessMenuItem).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await this.offlineAccessMenuItem.click();
  }

  async confirmEnableOfflineAccess() {
    await expect(this.offlineAccessEnableConfirm).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await this.offlineAccessEnableConfirm.click();
  }

  async expectPinIndicatorVisible() {
    await expect(this.offlineAccessPinIndicator).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }
}
