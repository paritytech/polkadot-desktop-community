import { type ElectronApplication, type Page, expect } from '@playwright/test';

import { TEST_IDS } from '@/shared/test-ids';
import { escapeRegex } from '../helpers/regex';
import { DEFAULT_TIMEOUT } from '../helpers/timeouts';

/**
 * Page Object for browser tab interactions.
 * Handles opening products in new tabs, switching between tabs,
 * and verifying that tab content is loaded (not a gray empty page).
 */
export class BrowserPage {
  constructor(
    private readonly page: Page,
    _app: ElectronApplication,
  ) {}

  get addressBar() {
    // Scoped to the header: the new-tab page renders its own inline AddressBar,
    // so an unscoped locator matches two inputs and trips strict-mode.
    return this.page.getByRole('banner').locator('[data-address-bar-input]');
  }

  /** All visible tab elements */
  get tabs() {
    return this.page.locator('[data-tab-id]');
  }

  /** New tab "+" button */
  private get newTabButton() {
    return this.page.getByTestId(TEST_IDS.newTabButton);
  }

  /** Get a specific tab by its identifier */
  tab(identifier: string) {
    return this.page.locator(`[data-tab-id="${identifier}"]`);
  }

  /** Open a product by typing its domain into the address bar.
   *  If tabs already exist, clicks "+" first; otherwise uses the address bar directly. */
  async openProductInNewTab(domain: string) {
    const hasNewTab = await this.newTabButton.isVisible().catch(() => false);

    if (hasNewTab) {
      // force: true needed because Electron's appRegion: 'drag' on the header
      // intercepts pointer events even though the button has appRegion: 'no-drag'
      await this.newTabButton.click({ force: true });
    }

    await this.addressBar.click();
    await this.addressBar.fill(domain);
    await this.addressBar.press('Enter');

    // <Tabs> hides the [data-tab-id] chip when there's exactly one selected
    // tab, so wait on the host route instead.
    await this.page.waitForURL(new RegExp(`#/product/${escapeRegex(domain)}(?:[/?]|$)`), {
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /** Click on a specific tab to switch to it */
  async switchToTab(identifier: string) {
    await this.tab(identifier).click();
    // Allow webview visibility toggle and content to settle
    await this.page.waitForTimeout(2_000);
  }

  /** Close every open product tab so the test starts from a known tab count. */
  async closeAllTabs() {
    // Each close click removes one tab and re-renders the list, so re-query
    // until no tabs remain.
    while (true) {
      const identifiers = await this.getTabIdentifiers();
      if (identifiers.length === 0) return;

      const first = identifiers[0]!;
      const closeButton = this.tab(first).getByRole('button', { name: 'Close tab' });
      await closeButton.click();
      await expect(this.tab(first)).toHaveCount(0, { timeout: DEFAULT_TIMEOUT });
    }
  }

  /** Get all tab identifiers in order */
  async getTabIdentifiers(): Promise<string[]> {
    const tabElements = await this.tabs.all();
    const identifiers: string[] = [];

    for (const tabEl of tabElements) {
      const id = await tabEl.getAttribute('data-tab-id');
      if (id) identifiers.push(id);
    }

    return identifiers;
  }

  /** Cycle through every open tab sequentially */
  async cycleThroughAllTabs() {
    const identifiers = await this.getTabIdentifiers();

    for (const id of identifiers) {
      await this.switchToTab(id);
    }
  }

  /**
   * Assert that the currently visible tab has a loaded webview.
   * A "gray page" means the webview exists but shows no content.
   * We verify the webview has a non-empty URL (content has loaded).
   * Also asserts no permission/alias dialog is left covering the product —
   * the autotest auto-approver feature should have dismissed it immediately.
   */
  async expectActiveTabHasContent() {
    await expect(
      this.page.getByTestId(TEST_IDS.aliasPermissionAllow),
      'alias permission dialog should be auto-approved, not overlapping product content',
    ).toBeHidden({ timeout: DEFAULT_TIMEOUT });
    await expect(
      this.page.getByTestId(TEST_IDS.permissionDialogAllowAlways),
      'device/remote permission dialog should be auto-approved, not overlapping product content',
    ).toBeHidden({ timeout: DEFAULT_TIMEOUT });

    const visibleWebview = this.page.locator('div[aria-hidden="false"] webview');

    await expect(visibleWebview).toBeAttached({ timeout: DEFAULT_TIMEOUT });

    // Verify the webview has loaded a real URL (not empty string)
    const hasUrl = await this.page.evaluate(() => {
      const wv = document.querySelector('div[aria-hidden="false"] webview');
      if (!wv || !('getURL' in wv)) return false;
      const getURL = wv.getURL;
      if (typeof getURL !== 'function') return false;
      return Boolean(getURL.call(wv));
    });

    expect(hasUrl).toBe(true);
  }

  /** Switch to each tab and verify it renders content */
  async expectAllTabsHaveContent() {
    const identifiers = await this.getTabIdentifiers();

    for (const id of identifiers) {
      await this.switchToTab(id);
      await this.expectActiveTabHasContent();
    }
  }
}
