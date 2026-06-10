import { type Page, expect } from '@playwright/test';

import { TEST_IDS } from '@/shared/test-ids';
import { DEFAULT_TIMEOUT } from '../helpers/timeouts';

export class UserPopover {
  constructor(private readonly page: Page) {}

  get displayName() {
    return this.page.getByTestId(TEST_IDS.userDisplayName);
  }

  get logoutButton() {
    return this.page.getByTestId(TEST_IDS.userLogoutButton);
  }

  async getUsername() {
    await expect(this.displayName).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    return this.displayName.textContent();
  }

  async logout() {
    await expect(this.logoutButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await this.logoutButton.click();
  }
}
