import { type Page, expect } from '@playwright/test';

import { DEFAULT_TIMEOUT } from '../helpers/timeouts';

/**
 * The per-product settings page (/settings/privacy/apps/<id>): Clear Cache and
 * Forget App, each behind a confirmation dialog. Controls are matched by text.
 */
export class ProductSettingsPage {
  constructor(private readonly page: Page) {}

  button(name: string) {
    return this.page.getByRole('button', { name, exact: true });
  }

  get cancelButton() {
    return this.button('Cancel');
  }

  async clickButton(name: string) {
    const button = this.button(name);
    await expect(button).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await button.click();
  }

  async cancelDialog() {
    await expect(this.cancelButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await this.cancelButton.click();
  }

  async expectDialogHidden() {
    await expect(this.cancelButton).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  async expectButtonVisible(name: string) {
    await expect(this.button(name)).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Confirm the destructive "Forget App" dialog. The page's "Forget App" button
   * and the dialog's confirm button share the same accessible name, so the
   * confirm is scoped to the open dialog to stay unambiguous.
   */
  async confirmForget() {
    const confirm = this.page.getByRole('dialog').getByRole('button', { name: 'Forget App', exact: true });
    await expect(confirm).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await confirm.click();
  }

  /**
   * Confirm the "Clear Cache" dialog. The page's "Clear Cache" button and the
   * dialog's confirm button share the same accessible name, so the confirm is
   * scoped to the open dialog to stay unambiguous.
   */
  async confirmClearCache() {
    const confirm = this.page.getByRole('dialog').getByRole('button', { name: 'Clear Cache', exact: true });
    await expect(confirm).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await confirm.click();
  }

  /**
   * The clear-cache action succeeded: the confirm dialog closes and a success
   * toast ("<product> cache cleared") surfaces. The toast carries no testid
   * (the imperative `toast.success` of `@/shared/components`), so it is matched by its text suffix.
   */
  async expectCacheCleared() {
    await expect(this.page.getByRole('dialog')).toBeHidden({ timeout: DEFAULT_TIMEOUT });
    await expect(this.page.getByText(/cache cleared/i).first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }
}
