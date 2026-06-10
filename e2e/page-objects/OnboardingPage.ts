import { type Page, expect } from '@playwright/test';

import { TEST_IDS } from '@/shared/test-ids';
import { type E2eEnvironmentId } from '../helpers/environment';
import { DEFAULT_TIMEOUT } from '../helpers/timeouts';

export class OnboardingPage {
  constructor(private readonly page: Page) {}

  get qrContainer() {
    return this.page.getByTestId(TEST_IDS.onboardingQrContainer);
  }

  get qrSvg() {
    return this.qrContainer.locator('svg');
  }

  get skipButton() {
    return this.page.getByTestId(TEST_IDS.onboardingSkip);
  }

  get signingBotPanel() {
    return this.page.getByTestId(TEST_IDS.signingBotPanel);
  }

  get signingBotUrlInput() {
    return this.page.getByTestId(TEST_IDS.signingBotUrlInput);
  }

  get signingBotTokenInput() {
    return this.page.getByTestId(TEST_IDS.signingBotTokenInput);
  }

  get signingBotConnectButton() {
    return this.page.getByTestId(TEST_IDS.signingBotConnect);
  }

  get signingBotStatus() {
    return this.page.getByTestId(TEST_IDS.signingBotStatus);
  }

  get signingBotUsernameInput() {
    return this.page.getByTestId(TEST_IDS.signingBotUsernameInput);
  }

  get signingBotReachable() {
    return this.page.getByTestId(TEST_IDS.signingBotReachable);
  }

  async waitForQrCode() {
    await expect(this.qrContainer).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    // QR may render as <svg> or <canvas> depending on the library config
    const qrContent = this.qrContainer.locator('svg, canvas');
    await expect(qrContent.first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  async getQrDimensions() {
    const qrContent = this.qrContainer.locator('svg, canvas').first();
    const box = await qrContent.boundingBox();

    return { width: box?.width ?? 0, height: box?.height ?? 0 };
  }

  async skipOnboarding() {
    await this.skipButton.locator('button').click({ timeout: DEFAULT_TIMEOUT });
    await this.page.waitForURL(/dashboard/, { timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Triggers an app reload, so caller must re-wait for QR after calling this.
   */
  async selectEnvironment(environmentId: E2eEnvironmentId) {
    const button = this.page.getByTestId(`${TEST_IDS.networkButton}-${environmentId}`);
    await expect(button).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await button.click();

    // Network change triggers a full reload — wait for the page to settle
    await this.page.waitForLoadState('domcontentloaded');
    await expect(this.page.locator('body')).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Pair via the signing bot panel UI.
   * Sets the bot URL, waits for health check, and clicks Connect.
   */
  async connectViaBot(botUrl: string, username?: string) {
    // Wait for the signing bot panel to appear
    await expect(this.signingBotPanel).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    // Fill in the bot URL (fill() clears existing value internally — no separate clear() needed)
    await this.signingBotUrlInput.fill(botUrl);

    // Wait for the bot health check to pass immediately after URL fill.
    // Doing this before other interactions avoids the green dot briefly disappearing
    // if something else triggers a re-render while we wait.
    await expect(this.signingBotReachable).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    // Fill in the username if provided
    if (username) {
      await expect(this.signingBotUsernameInput).toBeVisible({ timeout: DEFAULT_TIMEOUT });
      await this.signingBotUsernameInput.click();
      await this.signingBotUsernameInput.fill(username);
    }

    // Click "Connect to Bot"
    await expect(this.signingBotConnectButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await this.signingBotConnectButton.locator('button').click();
  }
}
