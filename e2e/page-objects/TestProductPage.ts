import { type ElectronApplication, type Page, expect } from '@playwright/test';

import { TEST_IDS } from '@/shared/test-ids';
import { DEFAULT_TIMEOUT, LONG_TIMEOUT, VERY_LONG_TIMEOUT } from '../helpers/timeouts';

import { AddressBarPage } from './AddressBarPage';

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
  private lastProductName: string | null = null;

  constructor(
    private readonly page: Page,
    private readonly app: ElectronApplication,
  ) {}

  /**
   * The header address bar — a button showing where you are, not an editable
   * field. Typing goes through the input surface it opens; `AddressBarPage` owns
   * both halves.
   */
  get addressBar() {
    return new AddressBarPage(this.page);
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

    await this.addressBar.submit(productName);

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
   * first checks for and clicks "Continue" in the allowance modal if that modal is present,
   * then clicks "Continue" in the signing modal.
   */
  /**
   * The product may request AutoSigning (or other) resource allocation before signing,
   * which queues in pappSsoQueue ahead of the sign request. Approve it so the queue
   * unblocks and the signing modal can appear. No-op when no allocation dialog shows.
   */
  private async approveAllocationIfPresent() {
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
  }

  async confirmSigning() {
    await this.approveAllocationIfPresent();

    const signButton = this.page.getByRole('button', { name: 'Continue', exact: true });
    await expect(signButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await signButton.click();
  }

  /**
   * Reject a pending signing request by cancelling the host signing modal. The
   * product's signing promise then rejects and the result surfaces the rejection.
   */
  async rejectSigning() {
    const cancelButton = this.page.getByRole('button', { name: 'Cancel', exact: true });
    await expect(cancelButton).toBeVisible({ timeout: LONG_TIMEOUT });
    await cancelButton.click();
  }

  // --- Sign Payload / Create Transaction review screen ----------------------
  // Shared review UI rendered by SignPayloadModal and CreateTransactionModal.
  // A transaction-producing host action (e.g. "Create Transaction with Product
  // Account", "Sign & Submit Batch") opens this screen before signing.

  get signReviewContinueButton() {
    return this.page.getByTestId(TEST_IDS.signReviewContinueButton);
  }

  get signReviewMoreDetailsButton() {
    return this.page.getByTestId(TEST_IDS.signReviewMoreDetails);
  }

  /**
   * Wait for the signing review screen to render. Approves a preceding resource
   * allocation dialog if the product requests one, then waits for the review's
   * "Continue to Sign" footer button — gated by chain connection + fee load, so
   * VERY_LONG_TIMEOUT.
   */
  async waitForSignReviewScreen() {
    await this.approveAllocationIfPresent();
    await expect(this.signReviewContinueButton).toBeVisible({ timeout: VERY_LONG_TIMEOUT });
  }

  /**
   * Assert the review summary shows account, network and call title.
   *
   * No fee row: estimating one needs the signer's address, which the host cannot derive
   * until the core persists the product subtree key, so `CreateTransactionModal` omits it
   * rather than showing a guess (TODO(truapi) there). Restore this assertion with the row.
   */
  async expectReviewSummaryFields() {
    await expect(this.page.getByTestId(TEST_IDS.signReviewCallTitle)).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await expect(this.page.getByTestId(TEST_IDS.signReviewAccount)).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await expect(this.page.getByTestId(TEST_IDS.signReviewNetwork)).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /** Click "More details" and assert the arguments + call-data sections expand. */
  async expandReviewDetails() {
    await expect(this.signReviewMoreDetailsButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await this.signReviewMoreDetailsButton.click();
    await expect(this.page.getByTestId(TEST_IDS.signReviewArguments)).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await expect(this.page.getByTestId(TEST_IDS.signReviewCallData)).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /** Assert the utility.batch* behaviour hint is shown on the review summary. */
  async expectBatchBehaviorHint() {
    await expect(this.page.getByTestId(TEST_IDS.signReviewBatchHint)).toBeVisible({ timeout: VERY_LONG_TIMEOUT });
  }

  /** Dismiss the review screen via its Cancel button (rejects the signing flow). */
  async cancelSignReview() {
    const cancelButton = this.page.getByRole('button', { name: 'Cancel', exact: true });
    await expect(cancelButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await cancelButton.click();
  }

  /**
   * Double-click "Continue to Sign" to exercise the re-entrancy guard
   * (signStartedRef): the second click must not start a second signing. The
   * review button leaves the DOM after the first click (the modal advances to
   * the signing step), so the double-click lands as two rapid events on the
   * same node before re-render.
   */
  async doubleClickContinueToSign() {
    await expect(this.signReviewContinueButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await this.signReviewContinueButton.dblclick();
  }

  /**
   * The core's device/remote permission prompt. This is the same
   * `RemotePermissionRequestDialog` the host's own remote-URL grant uses: the core takes
   * a `PermissionDecision`, not a boolean, and owns the stored decision. Deny, Allow Once
   * and Allow Always are always present. Requires the feature to be tagged
   * @manual-permissions (otherwise the auto-approver answers it first).
   */
  private get permissionApproveButton() {
    return this.page.getByTestId(TEST_IDS.permissionDialogAllowAlways);
  }

  private get permissionDenyButton() {
    return this.page.getByTestId(TEST_IDS.permissionDialogDeny);
  }

  /** Approve a host permission request. */
  async approvePermission() {
    await expect(this.permissionApproveButton).toBeVisible({ timeout: LONG_TIMEOUT });
    // force: the dialog animates in and can briefly fail the stability check.
    await this.permissionApproveButton.click({ force: true });
  }

  /** Assert a host device-permission request dialog is rendered. */
  async expectDevicePermissionDialog() {
    await expect(this.permissionApproveButton).toBeVisible({ timeout: LONG_TIMEOUT });
  }

  /** Reject a host permission request. */
  async denyPermission() {
    await expect(this.permissionDenyButton).toBeVisible({ timeout: LONG_TIMEOUT });
    await this.permissionDenyButton.click({ force: true });
  }

  /** Dismiss a host permission request without choosing (Escape → defaults to denied). */
  async dismissPermission() {
    await expect(this.permissionApproveButton).toBeVisible({ timeout: LONG_TIMEOUT });
    await this.page.keyboard.press('Escape');
  }

  // --- Alias permission dialog (getAlias) -----------------------------------

  /**
   * Assert the alias-permission request dialog is rendered. The testid sits on a
   * `display:contents` marker (no box of its own), so attachment is checked; the
   * Allow button's visibility confirms the dialog actually painted.
   */
  async expectAliasPermissionDialog() {
    await expect(this.page.getByTestId(TEST_IDS.aliasPermissionDialog)).toBeAttached({ timeout: LONG_TIMEOUT });
    // The alias dialog puts the testid directly on the <button> — the local Button
    // forwards data-testid.
    await expect(this.page.getByTestId(TEST_IDS.aliasPermissionAllow)).toBeVisible({ timeout: LONG_TIMEOUT });
  }

  /**
   * Approve an alias request. Like the permission prompt, the redesigned modal
   * offers one Allow — the once/always split went with the core's boolean answer
   * (`AliasPermissionModal`).
   */
  async allowAlias() {
    const button = this.page.getByTestId(TEST_IDS.aliasPermissionAllow);
    await expect(button).toBeVisible({ timeout: LONG_TIMEOUT });
    await button.click({ force: true });
  }

  /** Reject an alias request. Every request modal's footer carries the same deny testid. */
  async denyAlias() {
    const button = this.page.getByTestId(TEST_IDS.productRequestDeny);
    await expect(button).toBeVisible({ timeout: LONG_TIMEOUT });
    await button.click({ force: true });
  }

  /** Assert the alias-permission dialog has closed (decision accepted). */
  async expectAliasPermissionDialogClosed() {
    await expect(this.page.getByTestId(TEST_IDS.aliasPermissionDialog)).toBeHidden({ timeout: LONG_TIMEOUT });
  }

  // --- Allowance / resource allocation request dialog -----------------------

  /**
   * Assert the resource-allocation ("Allowance request") modal is rendered. This
   * dialog is NOT auto-approved by `e2e/helpers/dialogs.ts`, so it always shows
   * when a product requests a resource allocation, regardless of the
   * @manual-permissions tag.
   */
  async expectAllocationRequestDialog() {
    await expect(this.page.getByTestId(TEST_IDS.allocationRequestDialog)).toBeAttached({ timeout: VERY_LONG_TIMEOUT });
  }

  // --- Notifications (Host API) ---------------------------------------------
  // host-playground.dot ships its own testids on the Notification card controls:
  //   run-push-notification, arg-push-notification-scheduleInSeconds.
  // These belong to the deployed product, not the host app, so they are not in
  // src/shared/test-ids.ts (same convention as matching its action buttons by
  // text elsewhere in this PO).

  private get runPushNotificationButton() {
    return this.getWebview().getByTestId('run-push-notification');
  }

  private get scheduleInSecondsInput() {
    return this.getWebview().getByTestId('arg-push-notification-scheduleInSeconds');
  }

  /**
   * Fire a synchronous burst of immediate push notifications by clicking the
   * product's Push button {@link count} times in a single JS turn. Every push
   * first issues a (rate-limited) Notifications device-permission request, so a
   * burst trips the host's per-product rate limiter and surfaces a rate-limit
   * toast in the host window. Synchronous clicks guarantee we exceed the
   * 20-requests/second drop threshold regardless of CI click latency.
   */
  async fireBurstOfPushNotifications(count = 25) {
    await expect(this.runPushNotificationButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await this.runPushNotificationButton.evaluate((btn, n) => {
      if (!(btn instanceof HTMLElement)) return;
      for (let i = 0; i < n; i++) btn.click();
    }, count);
  }

  /**
   * Assert the host rendered a rate-limit toast naming the product and a limiter
   * type. The toast is a sonner toast drawn by the local Toaster (no forwardable testid), so it is
   * matched by sonner's stable `[data-sonner-toast]` attribute plus its visible
   * text: the title is the product name and the description is
   * "<limiterType> limit is reached".
   */
  async expectRateLimitToastNamesProduct(productName: string) {
    const toast = this.page.locator('[data-sonner-toast]', { hasText: 'limit is reached' });
    await expect(toast).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await expect(toast).toContainText(productName, { timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Put the future offset in the product's schedule field and make sure it stayed
   * there.
   *
   * The card is a controlled form that re-renders when a previous push settles, and
   * that re-render restores the stored (empty) args — so a `fill` whose value the CI
   * run then read back 14 times as `""` was not a lost keystroke, it was the product
   * resetting the field underneath. Re-fill until the value sticks rather than trust
   * one attempt.
   */
  private async setScheduleOffset(value: string) {
    await expect
      .poll(
        async () => {
          await this.scheduleInSecondsInput.fill(value);

          return this.scheduleInSecondsInput.inputValue();
        },
        { timeout: DEFAULT_TIMEOUT, message: 'the product kept resetting its schedule-offset field' },
      )
      .toBe(value);
  }

  /**
   * Fill the queue of FUTURE-scheduled notifications past the host cap so the
   * next schedule returns ScheduleLimitReached. Uses a far future offset so the
   * schedules stay pending in the host queue (counting toward the cap) instead
   * of firing, and keeps scheduling until the limit surfaces.
   *
   * The product disables the push button while each schedule round-trips to the
   * host and re-renders its log afterwards, so schedules only land at ~5/second.
   * Earlier fire-and-forget / in-page click strategies either lost the
   * actionability race against the re-render or no-op'd against the disabled
   * button, landing an unpredictable fraction (0–31) and never reaching the cap.
   * A *blocking* Playwright `.click()` instead waits for the button to be
   * actionable (enabled + stable) before each click, so every click lands and
   * the loop paces itself to the button's real availability. We stop as soon as
   * the limit surfaces rather than guessing a fixed over-shoot count; the small
   * pacing floor keeps us under the host's 20-per-1000ms rate-limit drop
   * threshold if the button ever stops gating.
   */
  async scheduleNotificationsPastLimit() {
    const FUTURE_OFFSET_SECONDS = '3600';
    const MAX_ATTEMPTS = 120; // > HOST_QUEUE_CAPACITY (64); a landed click per iteration overshoots
    const PACING_FLOOR_MS = 60; // ≤ ~16/s, under the 20/1000ms rate-limit drop threshold
    const WARMUP_SETTLE_MS = 3_000;
    const webview = this.getWebview();

    // Warm-up: one immediate push grants the Notifications device permission
    // (auto-approved) so the future schedules below don't race a dialog and
    // waste cap slots on permission-denied failures.
    await expect(this.runPushNotificationButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await this.runPushNotificationButton.click({ timeout: DEFAULT_TIMEOUT });
    await webview.waitForTimeout(WARMUP_SETTLE_MS);

    // Once the cap is exceeded the product logs the host's ScheduleLimitReached
    // rejection as a RangeError — that is the signal the over-shoot has surfaced,
    // so stop as soon as it appears. Kept in sync with the assertion in
    // host-api.feature (TC-11.1.5).
    const limitReached = webview.getByText('RangeError').first();
    // Only a FUTURE schedule stays pending in the host queue and counts toward the
    // cap; an immediate one fires and never does. Filling the offset once and
    // trusting it to survive is what left a CI run with 123 notifications, every
    // one of them "scheduled now" and the cap untouched — so re-assert it before
    // every click and prove the first one actually landed in the future.
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await this.setScheduleOffset(FUTURE_OFFSET_SECONDS);
      // Blocking click — waits for the button to be actionable, so it lands even
      // while the product gates/re-renders it between schedules.
      await this.runPushNotificationButton.click({ timeout: DEFAULT_TIMEOUT });

      if (i === 0) {
        await expect(
          webview.getByText('scheduled at').first(),
          'the product must schedule into the future, or nothing ever accumulates in the host queue',
        ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
      }
      if (await limitReached.isVisible().catch(() => false)) break;
      await webview.waitForTimeout(PACING_FLOOR_MS);
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

      // Body text can run to thousands of characters; the full copy goes to the
      // report attachment, the log keeps only enough to recognise the page.
      console.error(
        `[product] "${text}" not found at ${diagnostics.url}. Body: ${diagnostics.bodyText.slice(0, 300).replace(/\s+/g, ' ')}`,
      );
      throw err;
    }
  }

  /**
   * Capture the current webview body text and a screenshot for diagnostics.
   */
  async collectWebviewDiagnostics(): Promise<{ bodyText: string; screenshot: Buffer | null; url: string }> {
    const webview = this.getWebview();
    let bodyText: string;
    let screenshot: Buffer | null;
    let url: string;
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
