import { type Page, expect } from '@playwright/test';

import { TEST_IDS } from '@/shared/test-ids';
import { type E2eEnvironmentId } from '../helpers/environment';
import { DEFAULT_TIMEOUT, VERY_LONG_TIMEOUT } from '../helpers/timeouts';

export class OnboardingPage {
  constructor(private readonly page: Page) {}

  get qrContainer() {
    return this.page.getByTestId(TEST_IDS.onboardingQrContainer);
  }

  /**
   * The rendered QR matrix.
   *
   * `QrCode` (src/shared/components/QrCode) encodes with the `qrcode` package and
   * paints an `<img>` whose src is a data URL. Matching the data URL specifically is
   * what makes this a QR assertion: the same box also holds a `<Spinner>` (an `<svg>`)
   * while the pairing handshake is in flight, so a looser selector reports success
   * exactly when the QR is absent.
   */
  get qrImage() {
    return this.qrContainer.locator('img[src^="data:image"]');
  }

  get skipButton() {
    return this.page.getByTestId(TEST_IDS.onboardingSkip);
  }

  /**
   * The "Completing pairing…" spinner shown while the wallet's answer is being
   * resolved — the core's `AuthState.Authenticating`. When nightly attestation
   * lags, the pairing wedges here indefinitely instead of redirecting to
   * `/dashboard`; the sign-in helper watches this to abort a stuck attempt early.
   */
  get completingPairing() {
    return this.page.getByTestId(TEST_IDS.onboardingCompletingPairing);
  }

  /**
   * The pairing-failed panel — the core's `AuthState.LoginFailed { reason }`.
   * Carries a `data-error-kind` attribute: `noFreeSlots` is the "Limit Reached"
   * case — the peer reported no free allowance slots (the bot user's daily
   * device-registration budget is exhausted); everything else is `generic`.
   *
   * The kind is still derived by matching the reason STRING (`OnboardingScreen`'s
   * `errorContent`), because the core surfaces the failure as free text with no
   * typed variant — see `docs/_plans/truapi-upstream-issues.md`. If that regex
   * stops matching, this selector silently never resolves and the sign-in helper
   * burns its full timeout instead of failing fast.
   */
  get pairingError() {
    return this.page.getByTestId(TEST_IDS.onboardingPairingError);
  }

  /**
   * The "Limit Reached" flavor of {@link pairingError}. No same-identity retry
   * can clear it within a run — the sign-in helper watches this to fail fast
   * with `PairingLimitError` instead of burning the full navigation timeout.
   */
  get pairingLimitReachedError() {
    return this.page.locator(`[data-testid="${TEST_IDS.onboardingPairingError}"][data-error-kind="noFreeSlots"]`);
  }

  /**
   * Budgeted as a handshake, not as a UI wait, because that is what it is.
   *
   * Neither the container nor the image is in the DOM until the core reaches
   * `AuthState.Pairing`: until then `OnboardingScreen`'s `isBootReconnecting` renders
   * `<LoadingScreen/>` over the whole screen. Reaching `Pairing` means `requestLogin()`
   * completing against the network, so `DEFAULT_TIMEOUT` was the wrong category of budget
   * — 30s is what an element takes to render, not what a chain takes to answer.
   *
   * A genuinely failed pairing does NOT land here: `LoginFailed` clears
   * `isBootReconnecting` and paints the error panel inside this container, so the wait
   * ends. Reaching this timeout therefore means the handshake is still in flight, and the
   * only question is whether it would ever finish.
   */
  async waitForQrCode() {
    await expect(this.qrContainer).toBeVisible({ timeout: VERY_LONG_TIMEOUT });
    await expect(this.qrImage).toBeVisible({ timeout: VERY_LONG_TIMEOUT });
  }

  /**
   * The `polkadotapp://pair?...` deeplink behind the rendered QR, published by
   * `OnboardingScreen` under autotest mode. Waits on the attribute rather than the
   * image: the QR can be painted a frame before the attribute lands.
   */
  async pairingDeeplink(): Promise<string> {
    await expect(this.qrContainer).toHaveAttribute('data-pairing-deeplink', /^polkadotapp:\/\/pair\?/, {
      timeout: DEFAULT_TIMEOUT,
    });
    const value = await this.qrContainer.getAttribute('data-pairing-deeplink');
    if (!value) throw new Error('[onboarding] pairing deeplink attribute was empty after the wait resolved');

    return value;
  }

  async getQrDimensions() {
    await this.waitForQrCode();

    const box = await this.qrImage.boundingBox();
    if (!box) throw new Error('QR image has no bounding box');

    return { width: box.width, height: box.height };
  }

  /**
   * The skip button sits in the same block `isBootReconnecting` replaces with
   * `<LoadingScreen/>`, so it is gated on the pairing handshake exactly like
   * {@link waitForQrCode} — even though skipping is the act of not caring about pairing.
   * It therefore gets the handshake budget; the navigation that follows the click does
   * not, being ordinary routing.
   */
  async skipOnboarding() {
    await this.skipButton.click({ timeout: VERY_LONG_TIMEOUT });
    await this.page.waitForURL(/dashboard/, { timeout: DEFAULT_TIMEOUT });
  }

  networkButton(environmentId: E2eEnvironmentId) {
    return this.page.getByTestId(`${TEST_IDS.networkButton}-${environmentId}`);
  }

  /**
   * Assert the onboarding network selector has `environmentId` selected, and that
   * it is the ONLY selected segment. The active segment carries `aria-pressed=true`
   * (the SegmentedControl's `value`, `settings.environmentId`, in OnboardingScreen).
   */
  async expectSelectedEnvironment(environmentId: E2eEnvironmentId) {
    await expect(this.networkButton(environmentId)).toHaveAttribute('aria-pressed', 'true', {
      timeout: DEFAULT_TIMEOUT,
    });
    const selected = this.page.locator(`[data-testid^="${TEST_IDS.networkButton}-"][aria-pressed="true"]`);
    await expect(selected).toHaveCount(1, { timeout: DEFAULT_TIMEOUT });
  }

  /** All environment ids the onboarding picker currently offers (from the `network-button-<id>` testids). */
  async availableEnvironmentIds(): Promise<string[]> {
    const prefix = `${TEST_IDS.networkButton}-`;
    const buttons = this.page.locator(`[data-testid^="${prefix}"]`);
    await expect(buttons.first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    const ids: string[] = [];
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const testId = await buttons.nth(i).getAttribute('data-testid');
      if (testId?.startsWith(prefix)) ids.push(testId.slice(prefix.length));
    }
    return ids;
  }

  /** The currently selected environment id, or null if none is pressed. */
  async selectedEnvironmentId(): Promise<string | null> {
    const prefix = `${TEST_IDS.networkButton}-`;
    const pressed = this.page.locator(`[data-testid^="${prefix}"][aria-pressed="true"]`);
    if ((await pressed.count()) === 0) return null;
    const testId = await pressed.first().getAttribute('data-testid');
    return testId ? testId.slice(prefix.length) : null;
  }

  /**
   * Switch to any environment other than the currently selected one and return its id.
   * Triggers a reload, so callers must re-wait for the QR afterwards. Assumes ≥2
   * environments are configured (callers should skip otherwise — CI builds may ship one).
   */
  async switchToDifferentEnvironment(): Promise<string> {
    const ids = await this.availableEnvironmentIds();
    const current = await this.selectedEnvironmentId();
    const target = ids.find(id => id !== current);
    if (!target) throw new Error(`No alternative environment to switch to (available: ${ids.join(', ')})`);
    await this.page.getByTestId(`${TEST_IDS.networkButton}-${target}`).click();
    await this.page.waitForLoadState('domcontentloaded');
    await expect(this.page.locator('body')).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    return target;
  }

  /** Assert exactly one environment is selected and it is NOT `environmentId`. */
  async expectSelectedEnvironmentChangedFrom(environmentId: E2eEnvironmentId) {
    const prefix = `${TEST_IDS.networkButton}-`;
    const selected = this.page.locator(`[data-testid^="${prefix}"][aria-pressed="true"]`);
    await expect(selected).toHaveCount(1, { timeout: DEFAULT_TIMEOUT });
    await expect(this.networkButton(environmentId)).not.toHaveAttribute('aria-pressed', 'true', {
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Triggers an app reload, so caller must re-wait for QR after calling this.
   */
  async selectEnvironment(environmentId: E2eEnvironmentId) {
    // The picker is NOT stably mounted before the QR is. `OnboardingScreen`'s
    // `isBootReconnecting` replaces the whole screen with `<LoadingScreen/>` while the
    // core is still reaching `Pairing`, and that window opens *after* the people-chain
    // status settles — so the buttons render during the `reaching` phase, vanish, then
    // come back with the QR. Clicking in between finds the element, loses it mid-action,
    // and burns the full timeout on `waiting for getByTestId('network-button-<id>')`.
    await this.waitForQrCode();

    const button = this.page.getByTestId(`${TEST_IDS.networkButton}-${environmentId}`);
    await expect(button).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await button.click();

    // Network change triggers a full reload — wait for the page to settle
    await this.page.waitForLoadState('domcontentloaded');
    await expect(this.page.locator('body')).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }
}
