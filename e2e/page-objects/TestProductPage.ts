import { type ElectronApplication, type Page, expect } from '@playwright/test';

import { TEST_IDS } from '@/shared/test-ids';
import { DEFAULT_TIMEOUT, LONG_TIMEOUT, VERY_LONG_TIMEOUT } from '../helpers/timeouts';

/**
 * Page Object for the test-product-sdk test product page.
 * Handles navigation to the product and interaction with SDK test buttons.
 *
 * Product content renders inside an Electron <webview>, which Playwright
 * exposes as a separate Page (window). After navigation we must find that
 * webview page and interact with it directly.
 */
export class TestProductPage {
  private webviewPage: Page | null = null;
  private lastCategory: string | null = null;
  private lastAction: string | null = null;
  private lastProductName: string | null = null;

  constructor(
    private readonly page: Page,
    private readonly app: ElectronApplication,
  ) {}

  get addressBar() {
    return this.page.locator('[data-address-bar-input]');
  }

  /**
   * Find the webview page among existing windows.
   * The webview page is any window that is NOT the main app window.
   */
  private findWebviewPage(): Page | null {
    const windows = this.app.windows();
    return windows.find(w => w !== this.page && !w.isClosed()) ?? null;
  }

  /**
   * Navigate to a test product by entering its dotNS name in the address bar,
   * then wait for the webview page to appear.
   * If the webview is already open, reuses it.
   */
  async navigateTo(productName: string) {
    this.lastProductName = productName;
    // Check if webview already exists (e.g. from a previous test in Background)
    const existingWebview = this.findWebviewPage();
    if (existingWebview) {
      this.webviewPage = existingWebview;
      return;
    }

    const windowPromise = this.app.waitForEvent('window', { timeout: LONG_TIMEOUT });

    await this.addressBar.click();
    await this.addressBar.fill(productName);
    await this.addressBar.press('Enter');

    // The webview spawns a new window — wait for it
    this.webviewPage = await windowPromise;
    await this.webviewPage.waitForLoadState('domcontentloaded');
  }

  /**
   * Get the webview page (product content). Throws if navigateTo was not called.
   */
  private getWebview(): Page {
    if (!this.webviewPage) {
      throw new Error('Webview page not found. Call navigateTo() first.');
    }
    return this.webviewPage;
  }

  /**
   * Wait for the product UI to fully load.
   * Works in both wide (sidebar with CATEGORIES) and narrow (inline sections) layouts.
   *
   * Uses domcontentloaded + a heading visibility check rather than networkidle:
   * the product keeps long-poll/WebSocket connections open, so networkidle never
   * settles reliably and was flaky in CI.
   */
  async waitForProductReady() {
    const tryLoad = async () => {
      const webview = this.getWebview();
      await webview.waitForLoadState('domcontentloaded', { timeout: LONG_TIMEOUT });
      // Wait for the heading — present in both layouts
      await expect(webview.getByRole('heading', { name: 'Accounts' }).first()).toBeVisible({ timeout: LONG_TIMEOUT });
    };
    try {
      await tryLoad();
    } catch (err) {
      // Webview may have closed immediately (transient DotNS/IPFS failure).
      // Re-navigate once if we know the product name.
      if (!this.lastProductName) throw err;
      this.webviewPage = null;
      await this.navigateTo(this.lastProductName);
      await tryLoad();
    }
  }

  /**
   * Click a category tab (e.g. "Accounts", "Signing", etc.)
   * In wide layout: clicks a sidebar button in the CATEGORIES section.
   * In narrow layout: scrolls to the category heading (sections are already visible).
   */
  async clickCategory(categoryName: string) {
    this.lastCategory = categoryName;
    const webview = this.getWebview();
    const categoriesHeader = webview.getByText('CATEGORIES').first();

    if (await categoriesHeader.isVisible({ timeout: 2_000 }).catch(() => false)) {
      // Wide layout — sidebar with category buttons
      const categoriesSection = categoriesHeader.locator('..');
      await categoriesSection.getByRole('button', { name: categoryName }).click();
    } else {
      // Narrow layout — scroll to the category heading
      const heading = webview.getByRole('heading', { name: categoryName }).first();
      await heading.scrollIntoViewIfNeeded();
    }
  }

  /**
   * Run a test action by clicking its button (partial name match).
   */
  async runAction(actionName: string) {
    this.lastAction = actionName;
    const webview = this.getWebview();

    // Reset logs before running so previous results don't interfere with assertions
    await webview.getByRole('button', { name: 'Reset' }).click();

    // Action buttons contain a title + description. Filter to the button
    // that has an element with the exact action name text inside it.
    await webview
      .getByRole('button')
      .filter({ has: webview.getByText(actionName, { exact: true }) })
      .click();
  }

  /**
   * Reload the product by triggering the browser refresh action in the host app.
   *
   * Refresh remounts the React subtree (key change in `Browser.tsx`), so the
   * old `<webview>` is destroyed and a new guest BrowserView spawns.
   *
   * Three subtle hazards we have to defend against:
   *
   *  1. AddressBarRefreshButton becomes `pointer-events:none opacity-0` when
   *     the address bar is focused. Playwright's `.click()` then fails the
   *     actionability check (or, with `force: true`, the click target is the
   *     element underneath because of CSS hit-testing). We bypass the issue
   *     by dispatching a synthetic `click` directly via `dispatchEvent` —
   *     React's onClick handler fires regardless of CSS hit-testing. (The
   *     button's onMouseDown only calls preventDefault; the actual refresh
   *     handler is on onClick since dea62faf.)
   *  2. The new <webview> only mounts after `useDomainResolver` +
   *     `useIpfsProductArchive` both settle, each capped at 60s in
   *     `f6a28ca5`. Worst case can exceed LONG_TIMEOUT; bound by
   *     `VERY_LONG_TIMEOUT` (120s).
   *  3. Race between Playwright subscribing to the 'window' event and React
   *     spawning the new <webview>. Subscribe BEFORE dispatching to make the
   *     event-loss window zero, then fall back to polling app.windows() in
   *     case Playwright registered the Page synchronously between dispatch
   *     and subscribe.
   */
  async reloadProduct() {
    const oldWebview = this.webviewPage;
    const isCandidate = (w: Page) => w !== this.page && w !== oldWebview && !w.isClosed();

    const refreshButton = this.page.getByTestId(TEST_IDS.browserRefreshButton);
    await expect(refreshButton).toBeAttached({ timeout: DEFAULT_TIMEOUT });

    const newWindowPromise = this.app.waitForEvent('window', {
      predicate: isCandidate,
      timeout: VERY_LONG_TIMEOUT,
    });

    // dispatchEvent ignores CSS pointer-events and Playwright actionability,
    // and AddressBarRefreshButton's React `onClick` listener fires regardless
    // of where focus is.
    await refreshButton.dispatchEvent('click');

    const captured = await Promise.race([newWindowPromise, this.pollForCandidateWindow(isCandidate, VERY_LONG_TIMEOUT)]);

    this.webviewPage = captured;
    await captured.waitForLoadState('domcontentloaded', { timeout: LONG_TIMEOUT });
    await this.waitForProductReady();
  }

  private async pollForCandidateWindow(predicate: (w: Page) => boolean, timeoutMs: number): Promise<Page> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const next = this.app.windows().find(predicate);
      if (next) return next;
      await new Promise(r => setTimeout(r, 200));
    }
    throw new Error(`pollForCandidateWindow: no matching window within ${timeoutMs}ms`);
  }

  /**
   * Confirm a signing request in the host app modal.
   * The "Sign" button appears in a modal dialog on the main page (not the webview).
   *
   * The product may request resource allocation (e.g. AutoSigning) before signing.
   * When it does, the allocation modal appears first and blocks the signing queue —
   * so the signing "Continue" button never shows until the allocation is approved. This method
   * first checks for and clicks "Continue" in the allowance modal if that modal is present.
   *
   * After clicking "Continue" in the signing modal, waits briefly for a possible submit error
   * alert (e.g. NoAllowanceError when the account allowance isn't set up yet).
   * If the error appears AND the signing modal is still open (error is from signing,
   * not a background operation), cancels the modal, reloads the product, re-runs the
   * last category/action, and retries up to {@link MAX_SIGNING_RETRIES} times.
   */
  async confirmSigning() {
    const SUBMIT_ERROR_WATCH_MS = 15_000;
    const RETRY_DELAY_MS = 30_000;
    const MAX_SIGNING_RETRIES = 2;

    // The product may request AutoSigning (or other) resource allocation before signing,
    // which queues in pappSsoQueue ahead of the sign request. Approve it so the queue
    // unblocks and the signing modal can appear.
    const allocationContinueButton = this.page
      .getByRole('dialog', { name: 'Allowance request' })
      .getByRole('button', { name: 'Continue', exact: true });
    const needsAllocation = await allocationContinueButton
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (needsAllocation) {
      await allocationContinueButton.click();
      // Wait for the allocation dialog to fully close (bot approves on-chain)
      const allocationDialog = this.page.getByRole('dialog', { name: 'Allowance request' });
      await expect(allocationDialog).toBeHidden({ timeout: LONG_TIMEOUT });
    }

    for (let attempt = 0; ; attempt++) {
      const signButton = this.page.getByRole('button', { name: 'Continue', exact: true });
      await expect(signButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
      await signButton.click();

      // waitFor actually waits for the element to appear, unlike isVisible which checks instantly
      const errorAlert = this.page.getByTestId(TEST_IDS.submitErrorAlert);
      const hasError = await errorAlert
        .waitFor({ state: 'visible', timeout: SUBMIT_ERROR_WATCH_MS })
        .then(() => true)
        .catch(() => false);

      if (!hasError) {
        return;
      }

      // If the signing modal is already closed, the error was from a background
      // operation (e.g. statement-store), not from signing itself — the signing
      // succeeded, so skip the retry.
      const cancelButton = this.page.getByRole('button', { name: 'Cancel', exact: true });
      const isModalStillOpen = await cancelButton.isVisible().catch(() => false);
      if (!isModalStillOpen) {
        return;
      }

      if (attempt >= MAX_SIGNING_RETRIES) {
        throw new Error(`Signing failed with submit error after ${MAX_SIGNING_RETRIES + 1} attempts`);
      }

      console.warn(
        `[confirmSigning] Submit error detected (attempt ${attempt + 1}), waiting ${RETRY_DELAY_MS / 1000}s before retry...`,
      );

      // Close the signing modal
      await cancelButton.click();

      // Wait for allowance to propagate before retrying
      await this.page.waitForTimeout(RETRY_DELAY_MS);

      // Reload and replay the last category + action
      await this.reloadProduct();
      if (this.lastCategory) {
        await this.clickCategory(this.lastCategory);
      }
      if (this.lastAction) {
        await this.runAction(this.lastAction);
      }
    }
  }

  /**
   * Assert that the webview page contains expected result text.
   * On failure, returns a diagnostics payload (visible body text + HTML snippet)
   * so the caller can attach it to the test report.
   */
  async expectResultContains(text: string) {
    const webview = this.getWebview();
    try {
      await expect(webview.getByText(text).first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    } catch (err) {
      const diagnostics = await this.collectWebviewDiagnostics();

      console.error(
        `[expectResultContains] failed — looking for "${text}"\nwebview url: ${diagnostics.url}\nwebview body text:\n${diagnostics.bodyText}`,
      );
      throw err;
    }
  }

  /**
   * Capture the current webview body text and a screenshot for diagnostics.
   */
  async collectWebviewDiagnostics(): Promise<{ bodyText: string; screenshot: Buffer | null; url: string }> {
    const webview = this.getWebview();
    let bodyText = '';
    let screenshot: Buffer | null = null;
    let url = '';
    try {
      url = webview.url();
    } catch {
      url = '<failed to read webview url>';
    }
    try {
      bodyText = await webview.locator('body').innerText({ timeout: 2_000 });
    } catch {
      bodyText = '<failed to read webview body>';
    }
    try {
      screenshot = await webview.screenshot({ fullPage: true });
    } catch {
      screenshot = null;
    }
    return { bodyText, screenshot, url };
  }
}
