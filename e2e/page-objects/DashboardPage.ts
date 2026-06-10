import { type Page, type TestInfo, expect } from '@playwright/test';

import { TEST_IDS } from '@/shared/test-ids';
import { DEFAULT_TIMEOUT } from '../helpers/timeouts';

export class DashboardPage {
  constructor(private readonly page: Page) {}

  get userButton() {
    return this.page.getByTestId(TEST_IDS.userButton);
  }

  get quickChatButton() {
    return this.page.getByTestId(TEST_IDS.quickChatButton);
  }

  get userSettingsAction() {
    return this.page.getByTestId(TEST_IDS.userSettingsAction);
  }

  get editModeToggle() {
    return this.page.getByTestId(TEST_IDS.dashboardEditModeToggle);
  }

  get addWidgetButton() {
    return this.page.getByTestId(TEST_IDS.dashboardAddWidgetButton);
  }

  async toggleEditMode() {
    await this.editModeToggle.locator('button').click({ timeout: DEFAULT_TIMEOUT });
  }

  async openAddWidgetModal() {
    await this.addWidgetButton.locator('button').click({ timeout: DEFAULT_TIMEOUT });
  }

  get homeButton() {
    return this.page.getByTestId(TEST_IDS.homeButton);
  }

  async navigateToDashboard() {
    if (this.page.url().includes('dashboard')) return;
    await this.homeButton.click({ timeout: DEFAULT_TIMEOUT });
    await this.page.waitForURL(/dashboard/, { timeout: DEFAULT_TIMEOUT });
  }

  async waitForDashboard() {
    await this.page.waitForURL(/dashboard/, { timeout: DEFAULT_TIMEOUT });
    await this.page.waitForLoadState('domcontentloaded', { timeout: DEFAULT_TIMEOUT });
  }

  async clickUserButton() {
    await this.userButton.locator('button').click({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Switch to a specific theme. The toggle moved out of the top bar into
   * Settings → Appearance, so this navigates there, picks the option,
   * then returns to the dashboard for any follow-up assertions.
   */
  async setTheme(theme: 'Light' | 'Dark' | 'System') {
    await this.openSettings();
    await this.page.waitForURL(/settings/, { timeout: DEFAULT_TIMEOUT });

    const appearanceLink = this.page.getByRole('link', { name: 'Appearance' });
    await expect(appearanceLink).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await appearanceLink.click();

    const themeOption = this.page.getByRole('radio', { name: theme, exact: true });
    await expect(themeOption).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await themeOption.click();

    await this.navigateToDashboard();
  }

  async openQuickChat() {
    await this.quickChatButton.locator('button').click({ timeout: DEFAULT_TIMEOUT });
  }

  async openSettings() {
    await this.clickUserButton();
    await expect(this.userSettingsAction).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await this.userSettingsAction.click();
  }

  async takeScreenshot(testInfo: TestInfo, name: string) {
    const screenshot = await this.page.screenshot();
    await testInfo.attach(name, { body: screenshot, contentType: 'image/png' });
  }
}
