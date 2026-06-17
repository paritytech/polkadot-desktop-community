import { type Page, expect } from '@playwright/test';

import { TEST_IDS } from '@/shared/test-ids';
import { DEFAULT_TIMEOUT, LONG_TIMEOUT } from '../helpers/timeouts';

/**
 * Page Object for the product actions menu (•••) and its items,
 * including "Enable offline access" and "Proceed in Chat".
 */
export class ProductActionsPage {
  constructor(private readonly page: Page) {}

  get menuTrigger() {
    return this.page.getByTestId(TEST_IDS.productActionsMenuTrigger);
  }

  /**
   * The "Proceed in Chat" menu item. It only renders for products whose worker
   * declares chat support, so it's matched by its accessible name (the shared
   * `productActionsMenuItem` testid can't disambiguate it from sibling items).
   */
  get proceedInChatMenuItem() {
    return this.page.getByRole('menuitem', { name: 'Proceed in Chat', exact: true });
  }

  get proceedInChatConfirmButton() {
    return this.page.getByTestId(TEST_IDS.proceedInChatDialogConfirmButton);
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

  /**
   * Establish a product chat session: open the ••• menu, pick "Proceed in Chat",
   * and confirm the dialog. As of the "declare product rooms in-memory until
   * Proceed in Chat confirm" change, this explicit confirmation is what persists
   * the room so it surfaces in the Quick Chat popover. The confirm button stays
   * disabled until the product worker has declared its in-memory room, so we wait
   * for it to become enabled before clicking.
   */
  async proceedInChat() {
    await this.openMenu();
    await expect(this.proceedInChatMenuItem).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await this.proceedInChatMenuItem.click();

    await expect(this.proceedInChatConfirmButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await expect(this.proceedInChatConfirmButton).toBeEnabled({ timeout: LONG_TIMEOUT });
    await this.proceedInChatConfirmButton.click();
  }
}
