import { type Page, type TestInfo, expect } from '@playwright/test';

import { TEST_IDS } from '@/shared/test-ids';
import { DEFAULT_TIMEOUT, LONG_TIMEOUT } from '../helpers/timeouts';

export class DashboardPage {
  constructor(private readonly page: Page) {}

  get userButton() {
    return this.page.getByTestId(TEST_IDS.userButton);
  }

  get connectionStatus() {
    return this.page.getByTestId(TEST_IDS.userConnectionStatus);
  }

  /** The user-button badge reflects connection as a `data-state` attribute. */
  async expectConnectionState(state: 'connected' | 'reconnecting' | 'offline' | 'no-connection') {
    await expect(this.connectionStatus).toHaveAttribute('data-state', state, { timeout: DEFAULT_TIMEOUT });
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
   * Switch to a specific color mode. The toggle moved out of the top bar into
   * Settings → Appearance, so this navigates there, picks the option,
   * then returns to the dashboard for any follow-up assertions.
   * Labels follow the appearance redesign (PR #744): Device / Day / Night
   * (formerly System / Light / Dark).
   */
  async setTheme(theme: 'Day' | 'Night' | 'Device') {
    await this.openSettings();
    await this.page.waitForURL(/settings/, { timeout: DEFAULT_TIMEOUT });

    const appearanceLink = this.page.getByRole('link', { name: 'Appearance' });
    await expect(appearanceLink).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await appearanceLink.click();

    const themeOption = this.page.getByRole('button', { name: theme, exact: true });
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

  // --- Layout & cards ---------------------------------------------------------

  get grid() {
    return this.page.getByTestId(TEST_IDS.dashboardGrid).first();
  }

  get emptyState() {
    return this.page.getByTestId(TEST_IDS.dashboardEmptyState);
  }

  get productWidgets() {
    return this.page.getByTestId(TEST_IDS.dashboardProductWidget);
  }

  get favoritesFolder() {
    return this.page.getByTestId(TEST_IDS.dashboardFavoritesFolder);
  }

  get favoriteIcons() {
    return this.page.getByTestId(TEST_IDS.dashboardFavoriteIcon);
  }

  /**
   * A brand-new user is seeded a single default product widget
   * (`ensureDefaultDashboard` → `DEFAULT_DASHBOARD_PAGES`), so the dashboard is
   * not empty on first run. Remove every top-level widget via its card menu to
   * reach the empty state.
   */
  async removeAllWidgets() {
    // The card ••• menu trigger is opacity-0 until hover, but still hit-testable;
    // force the click so Electron's draggable header can't swallow the pointer.
    for (let guard = 0; guard < 10; guard++) {
      const trigger = this.page.getByTestId(TEST_IDS.dashboardWidgetMenuTrigger).first();
      if ((await trigger.count()) === 0) break;
      await trigger.click({ force: true, timeout: DEFAULT_TIMEOUT });

      const remove = this.page.getByTestId(TEST_IDS.dashboardWidgetMenuRemove);
      await expect(remove).toBeVisible({ timeout: DEFAULT_TIMEOUT });
      await remove.click();
      await expect(trigger).toBeHidden({ timeout: DEFAULT_TIMEOUT });
    }
  }

  async expectEmptyState() {
    await expect(this.emptyState).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await expect(this.page.getByTestId(TEST_IDS.dashboardEmptyStateAddWidget)).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  async expectProductWidgetVisible() {
    await expect(this.productWidgets.first()).toBeVisible({ timeout: LONG_TIMEOUT });
  }

  async expectFavoritesFolderWithIcon() {
    await expect(this.favoritesFolder).toBeVisible({ timeout: LONG_TIMEOUT });
    await expect(this.favoriteIcons.first()).toBeVisible({ timeout: LONG_TIMEOUT });
  }

  async expectFavoritesFolderAbsent() {
    await expect(this.favoritesFolder).toHaveCount(0, { timeout: DEFAULT_TIMEOUT });
  }

  async expectFavoritesFolderHidden() {
    await expect(this.favoritesFolder).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /** Open the product fullscreen by clicking its 1×1 favorites-folder icon. */
  async openFirstFavoriteIcon() {
    await expect(this.favoriteIcons.first()).toBeVisible({ timeout: LONG_TIMEOUT });
    await this.favoriteIcons.first().click();
  }

  /**
   * Remove the favorites folder via its card ••• menu. The folder card uses the
   * same `WidgetMenu` as product cards (its remove item is labelled "Remove
   * Folder"), so the shared menu-trigger / remove testids apply.
   */
  async removeFavoritesFolder() {
    const trigger = this.favoritesFolder.getByTestId(TEST_IDS.dashboardWidgetMenuTrigger);
    await expect(trigger).toBeAttached({ timeout: LONG_TIMEOUT });
    await trigger.click({ force: true, timeout: DEFAULT_TIMEOUT });

    const remove = this.page.getByTestId(TEST_IDS.dashboardWidgetMenuRemove);
    await expect(remove).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await remove.click();
  }

  /** True when the grid's content overflows its viewport horizontally. */
  async isGridHorizontallyScrollable(): Promise<boolean> {
    return this.grid.evaluate(el => el.scrollWidth > el.clientWidth);
  }

  /** The "Domain not found" body a product widget renders when its executable can't resolve. */
  get productWidgetNotFound() {
    return this.page.getByTestId(TEST_IDS.productWidgetNotFound);
  }

  async expectWidgetNotFound() {
    await expect(this.productWidgetNotFound.first()).toBeVisible({ timeout: LONG_TIMEOUT });
  }

  // --- Dashboard pagination (page indicator dots) ---

  get paginationTabs() {
    return this.page.getByTestId(TEST_IDS.dashboardPaginationTab);
  }

  async expectPaginationTabCount(count: number) {
    await expect(this.paginationTabs).toHaveCount(count, { timeout: DEFAULT_TIMEOUT });
  }

  /** Click the nth (0-based) page indicator dot. */
  async selectPage(index: number) {
    await this.paginationTabs.nth(index).click({ timeout: DEFAULT_TIMEOUT });
  }

  /** Assert the nth page indicator dot is the active one (aria-selected=true). */
  async expectPageActive(index: number) {
    await expect(this.paginationTabs.nth(index)).toHaveAttribute('aria-selected', 'true', { timeout: DEFAULT_TIMEOUT });
  }
}
