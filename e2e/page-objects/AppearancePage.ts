import { type Page, expect } from '@playwright/test';

import { TEST_IDS } from '@/shared/test-ids';
import { colorModeButton } from '../helpers/colorMode';
import { DEFAULT_TIMEOUT } from '../helpers/timeouts';

import { DashboardPage } from './DashboardPage';

/**
 * Page Object for Settings → Appearance (post-redesign, PR #744).
 *
 * The page hosts two groups with disjoint accessible names:
 *  - "Color mode" — Device / Day / Night (segmented control of aria-pressed buttons);
 *  - "Theme" — Berlin / Tokyo / Lisbon / Malta (radiogroup of swatch cards, aria-label).
 * Plus a decorative chat-mock preview (aria-hidden, located by testid).
 *
 * Applied-state signals (what the app actually renders, beyond aria-checked / aria-pressed):
 *  - dark/light: `ThemeSyncer` toggles the `dark` class on <html> and mirrors the mode into `color-scheme`;
 *  - theme palette: `ThemeNameSyncer` writes `data-theme` on <html>, and `chrome.css` gives each palette its own
 *    `--chrome-top`; assertions check that the computed value changes.
 */
export class AppearancePage {
  constructor(private readonly page: Page) {}

  /** Navigate user popover → Settings → Appearance. */
  async open() {
    const dashboard = new DashboardPage(this.page);
    await dashboard.openSettings();
    await this.page.waitForURL(/settings/, { timeout: DEFAULT_TIMEOUT });

    const appearanceLink = this.page.getByRole('link', { name: 'Appearance', exact: true });
    await expect(appearanceLink).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await appearanceLink.click();
  }

  // --- Color mode (pressed buttons) ------------------------------------------

  colorMode(name: string) {
    return colorModeButton(this.page, name);
  }

  async expectColorModesVisible(names: string[]) {
    for (const name of names) {
      await expect(this.colorMode(name)).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    }
  }

  async selectColorMode(name: string) {
    const option = this.colorMode(name);
    await expect(option).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await option.click();
  }

  async expectColorModeSelected(name: string) {
    await expect(this.colorMode(name)).toHaveAttribute('aria-pressed', 'true', { timeout: DEFAULT_TIMEOUT });
  }

  // --- Theme picker (radios) -------------------------------------------------

  radio(name: string) {
    return this.page.getByRole('radio', { name, exact: true });
  }

  async expectRadiosVisible(names: string[]) {
    for (const name of names) {
      await expect(this.radio(name)).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    }
  }

  async selectRadio(name: string) {
    const radio = this.radio(name);
    await expect(radio).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await radio.click();
    // `aria-checked` follows the stored theme row, so a caller that reloads next does not lose the choice.
    await expect(radio).toBeChecked({ timeout: DEFAULT_TIMEOUT });
  }

  async expectRadioSelected(name: string) {
    await expect(this.radio(name)).toBeChecked({ timeout: DEFAULT_TIMEOUT });
  }

  // --- Applied appearance (DOM-level, not just aria-checked) -----------------

  /** The resolved dark/light mode actually rendered by the app shell. */
  async expectAppliedMode(mode: 'dark' | 'light') {
    const html = this.page.locator('html');
    // the syncer applies the mode in an effect after the stored row is read
    if (mode === 'dark') {
      await expect(html).toHaveClass(/(?:^|\s)dark(?:\s|$)/, { timeout: DEFAULT_TIMEOUT });
    } else {
      await expect(html).not.toHaveClass(/(?:^|\s)dark(?:\s|$)/, { timeout: DEFAULT_TIMEOUT });
    }
    await expect(html).toHaveCSS('color-scheme', mode, { timeout: DEFAULT_TIMEOUT });
  }

  /** Computed value of the palette's signature CSS variable on <html>. */
  readPaletteVar(): Promise<string> {
    return this.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--chrome-top').trim());
  }

  /** Poll until the applied palette differs from a previously captured value. */
  async expectPaletteChangedFrom(previous: string) {
    await expect.poll(() => this.readPaletteVar(), { timeout: DEFAULT_TIMEOUT }).not.toBe(previous);
    expect(await this.readPaletteVar()).not.toBe('');
  }

  // --- Preview ---------------------------------------------------------------

  async expectPreviewVisible() {
    await expect(this.page.getByTestId(TEST_IDS.themePreview)).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }
}
