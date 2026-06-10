import { type Page, expect } from '@playwright/test';

import { TEST_IDS } from '@/shared/test-ids';
import { DEFAULT_TIMEOUT } from '../helpers/timeouts';

export class ContactSearchPage {
  constructor(private readonly page: Page) {}

  get searchInput() {
    return this.page.getByTestId(TEST_IDS.contactSearchInput);
  }

  get resultItems() {
    return this.page.getByTestId(TEST_IDS.contactResultItem);
  }

  resultByName(username: string) {
    return this.resultItems.filter({ hasText: username });
  }

  get welcomeInput() {
    return this.page.getByTestId(TEST_IDS.contactWelcomeInput);
  }

  get sendRequestButton() {
    return this.page.getByTestId(TEST_IDS.contactSendRequestButton);
  }

  /**
   * Open the contact search panel from an already-open Chat Fullscreen (SPA).
   * Fullscreen must be opened beforehand via ChatPage.openFullscreen().
   */
  async openFromFullscreen() {
    const searchToggle = this.page.getByTestId(TEST_IDS.chatSearchToggleButton);
    await expect(searchToggle).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await searchToggle.click();
    await expect(this.searchInput).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  async typeQuery(query: string) {
    await expect(this.searchInput).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await this.searchInput.fill(query);
  }

  async waitForResult(username: string) {
    await expect(this.resultByName(username)).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  async selectResult(username: string) {
    await this.resultByName(username).click();
    await expect(this.welcomeInput).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  async fillWelcome(text: string) {
    await this.welcomeInput.fill(text);
  }

  /**
   * Click "Send Request" and wait for the compose view to dismiss.
   *
   * Retries on transient on-chain failures — the first attempt can fail with
   * "Could not find encryption key for {address}" when the peer's P256 key
   * hasn't propagated through the Alice-side chain client yet (common right
   * after both users finished sign-in). The UI keeps the button enabled on
   * error, so a second click usually succeeds once the query refreshes.
   */
  async submitRequest(options: { retries?: number; retryDelayMs?: number } = {}) {
    // Generous first-attempt timeout so we don't double-send: the first click
    // normally succeeds on-chain, but the UI can take >10s to dismiss the
    // compose view while the statement is confirmed. A retry in that window
    // posts a duplicate request that pollutes the peer's accept list on the
    // next scenario (strict-mode violations on `chatRequestAcceptButton`).
    const { retries = 3, retryDelayMs = 3000 } = options;
    for (let attempt = 1; attempt <= retries; attempt++) {
      await expect(this.sendRequestButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
      await this.sendRequestButton.locator('button').click();
      try {
        await expect(this.sendRequestButton).toBeHidden({ timeout: DEFAULT_TIMEOUT });
        return;
      } catch {
        if (attempt === retries) {
          throw new Error(`[ContactSearchPage] Send Request did not dismiss the compose view after ${retries} attempts`);
        }
        console.warn(`[ContactSearchPage] Send Request attempt ${attempt} did not dismiss; retrying in ${retryDelayMs}ms...`);
        await this.page.waitForTimeout(retryDelayMs);
      }
    }
  }
}
