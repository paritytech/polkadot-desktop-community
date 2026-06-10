import { type Page, expect } from '@playwright/test';

import { LONG_TIMEOUT } from '../helpers/timeouts';
import { evaluateInWebview } from '../helpers/webview';

/**
 * Interactions with the link-tests product rendered inside the active webview.
 * All interactions happen through `executeJavaScript` on the webview guest
 * page — Playwright cannot descend into the webview DOM directly.
 */
export class LinkTestsPage {
  constructor(private readonly page: Page) {}

  /** Resolves once the fixture's ready marker is emitted to the webview console. */
  async waitForReady() {
    await this.page.waitForFunction(
      async () => {
        const wv = document.querySelector<HTMLElement & { executeJavaScript: (c: string) => Promise<unknown> }>(
          'div[aria-hidden="false"] webview',
        );
        if (!wv || typeof wv.executeJavaScript !== 'function') return false;
        const body = await wv.executeJavaScript('document.querySelector(`[data-testid=status]`)?.textContent || null');
        return typeof body === 'string' && body.includes('pathname');
      },
      { timeout: LONG_TIMEOUT },
    );
  }

  /** Click a button inside the webview by its data-testid. */
  async clickButton(testId: string) {
    await evaluateInWebview<void>(
      this.page,
      `(() => { const el = document.querySelector('[data-testid="${testId}"]'); if (!el) throw new Error('no ' + '${testId}'); el.click(); })()`,
    );
  }

  /** Read window.location.pathname from the visible webview guest page. */
  async webviewPathname(): Promise<string> {
    return this.page.evaluate(async () => {
      type Wv = HTMLElement & { executeJavaScript: (code: string) => Promise<unknown>; getURL: () => string };
      const wv = document.querySelector<Wv>('div[aria-hidden="false"] webview');
      if (!wv || typeof wv.executeJavaScript !== 'function') throw new Error('no visible webview');
      const p = await wv.executeJavaScript('window.location.pathname');
      return typeof p === 'string' ? p : '';
    });
  }

  /** Full URL of the visible webview — useful for diagnostics. */
  async webviewUrl(): Promise<string> {
    return this.page.evaluate(() => {
      type Wv = HTMLElement & { executeJavaScript: (code: string) => Promise<unknown>; getURL: () => string };
      const wv = document.querySelector<Wv>('div[aria-hidden="false"] webview');
      if (!wv) return '';
      return wv.getURL?.() ?? '';
    });
  }

  /** Fire a direct pushState inside the webview without a user click. */
  async pushNow(path: string) {
    await evaluateInWebview<void>(this.page, `window.__linkTests.pushNow(${JSON.stringify(path)})`);
  }

  /** Schedule a pushState 1500ms in the future — simulates an SPA's boot redirect. */
  async scheduleDelayedPush() {
    await evaluateInWebview<void>(this.page, 'window.__linkTests.delayedPush()');
  }

  async expectWebviewPathname(expected: string) {
    await expect.poll(() => this.webviewPathname(), { timeout: LONG_TIMEOUT }).toBe(expected);
  }
}
