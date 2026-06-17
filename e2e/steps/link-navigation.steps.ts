import { type Page, expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

import { TEST_IDS } from '@/shared/test-ids';
import { test } from '../fixtures/link-tests';
import { escapeRegex } from '../helpers/regex';
import { DEFAULT_TIMEOUT, LONG_TIMEOUT } from '../helpers/timeouts';
import { BrowserPage } from '../page-objects/BrowserPage';
import { LinkTestsPage } from '../page-objects/LinkTestsPage';

const { Given, When, Then } = createBdd(test);

const hostPathname = (page: Page) =>
  page.evaluate(() => {
    const raw = window.location.hash.replace(/^#/, '') || window.location.pathname;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  });

Given('the link-tests product is open in a tab', async ({ electronApp, linkTestsTarget }) => {
  const browser = new BrowserPage(electronApp.window, electronApp.app);

  // Inline the open flow: BrowserPage.openProductInNewTab waits on a tab whose
  // data-tab-id equals the filled value, but our address bar input includes a
  // path (`localhost:<port>/link-tests`) while the tab id is the identifier
  // only (`localhost:<port>`).
  const newTabButton = electronApp.window.getByTestId(TEST_IDS.newTabButton);
  if (await newTabButton.isVisible().catch(() => false)) {
    await newTabButton.click({ force: true });
  }
  await browser.addressBar.click();
  await browser.addressBar.fill(linkTestsTarget.address);
  await browser.addressBar.press('Enter');
  // <Tabs> hides the [data-tab-id] chip when there's exactly one selected tab,
  // so wait on the host route instead.
  await expect
    .poll(() => hostPathname(electronApp.window), { timeout: LONG_TIMEOUT })
    .toMatch(new RegExp(`^/product/${escapeRegex(linkTestsTarget.identifier)}(?:/|$)`));

  const page = new LinkTestsPage(electronApp.window);
  await page.waitForReady();
});

When('the link-tests product dispatches a pushState to {string}', async ({ electronApp }, path: string) => {
  const page = new LinkTestsPage(electronApp.window);
  await page.pushNow(path);
});

When('the user dispatches a pushState in the link-tests product to {string}', async ({ electronApp }, path: string) => {
  const page = new LinkTestsPage(electronApp.window);
  await page.pushNow(path);
});

When('the user clicks the link-tests button {string}', async ({ electronApp }, testId: string) => {
  const page = new LinkTestsPage(electronApp.window);
  await page.clickButton(testId);
});

When('the user schedules a delayed pushState in the link-tests product', async ({ electronApp }) => {
  const page = new LinkTestsPage(electronApp.window);
  await page.scheduleDelayedPush();
});

When('the user waits for the delayed pushState to fire', async ({ electronApp }) => {
  // The fixture schedules the push at +1500ms; give it a margin to fire and the
  // host-route sync (if any) to flush.
  await electronApp.window.waitForTimeout(2_500);
});

/**
 * Fire pushState directly on the backgrounded webview via Electron's
 * executeJavaScript IPC. This deterministically reproduces the regression
 * scenario from PR #346 — a `did-navigate-in-page` event arriving from a
 * backgrounded tab — without relying on a setTimeout firing inside the hidden
 * guest renderer. Chromium aggressively freezes/throttles timers in
 * <webview>s whose parent has display:none on Linux and Windows; using a
 * timer here makes the test platform-dependent. The IPC path is platform-
 * neutral: executeJavaScript wakes the renderer, runs the script, the resulting
 * pushState fires the same did-navigate-in-page event the host would receive
 * in production from a real SPA boot redirect.
 */
When(
  'the link-tests product fires a pushState to {string} while backgrounded',
  async ({ electronApp, linkTestsTarget }, path: string) => {
    await fireBackgroundedPushState(electronApp.window, linkTestsTarget.identifier, path);
  },
);

When('the user waits for navigation to settle', async ({ electronApp }) => {
  await electronApp.window.waitForTimeout(1_500);
});

When('the user navigates to the dashboard', async ({ electronApp }) => {
  const homeButton = electronApp.window.getByTestId(TEST_IDS.homeButton);
  await expect(homeButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await homeButton.click({ force: true });
  await expect.poll(() => hostPathname(electronApp.window), { timeout: DEFAULT_TIMEOUT }).toMatch(/\/dashboard/);
});

When('the user returns to the link-tests tab', async ({ electronApp, linkTestsTarget }) => {
  const browser = new BrowserPage(electronApp.window, electronApp.app);
  await browser.switchToTab(linkTestsTarget.identifier);
});

When('the user types the link-tests identifier into the address bar', async ({ electronApp, linkTestsTarget }) => {
  const browser = new BrowserPage(electronApp.window, electronApp.app);
  await browser.addressBar.click();
  await browser.addressBar.fill(linkTestsTarget.identifier);
  await browser.addressBar.press('Enter');
});

Then('the host route pathname ends with {string}', async ({ electronApp }, suffix: string) => {
  await expect
    .poll(() => hostPathname(electronApp.window), { timeout: LONG_TIMEOUT })
    .toMatch(new RegExp(`${escapeRegex(suffix)}$`));
});

Then('the host route pathname settles at the link-tests product root', async ({ electronApp, linkTestsTarget }) => {
  const root = new RegExp(`/product/${escapeRegex(linkTestsTarget.identifier)}/?$`);
  await expect.poll(() => hostPathname(electronApp.window), { timeout: LONG_TIMEOUT }).toMatch(root);
  // Hold the assertion for a beat: if useSelectedTabRouterSync and
  // useTabAutoSync were fighting, the route would oscillate rather than
  // settle. A single poll match could coincide with a mid-oscillation frame.
  await electronApp.window.waitForTimeout(500);
  expect(await hostPathname(electronApp.window)).toMatch(root);
});

Then('the host is on the dashboard', async ({ electronApp }) => {
  await expect.poll(() => hostPathname(electronApp.window), { timeout: DEFAULT_TIMEOUT }).toMatch(/\/dashboard/);
});

Then('the host stays on the dashboard for {int}ms', async ({ electronApp }, holdMs: number) => {
  // Hold the assertion across `holdMs` to catch any spurious bounce: a
  // regressed handler would route to /product/ on a did-navigate-in-page
  // event, then useTabAutoSync may sync back to /dashboard a frame later —
  // a single read could miss the bounce.
  const deadline = Date.now() + holdMs;
  while (Date.now() < deadline) {
    const pathname = await hostPathname(electronApp.window);
    expect(pathname, `host bounced to ${pathname}`).toMatch(/\/dashboard/);
    expect(pathname, `host bounced to ${pathname}`).not.toMatch(/\/product\//);
    await electronApp.window.waitForTimeout(100);
  }
});

Then('the backgrounded webview pathname ends with {string}', async ({ electronApp, linkTestsTarget }, suffix: string) => {
  // Poll until the backgrounded webview's url reflects the expected pathname.
  // The pushState event propagates over IPC (renderer → main → renderer);
  // a single read can race the propagation, especially on a frozen guest.
  await expect
    .poll(() => readBackgroundedPathname(electronApp.window, linkTestsTarget.identifier), {
      timeout: LONG_TIMEOUT,
      intervals: [100, 250, 500],
    })
    .toMatch(new RegExp(`${escapeRegex(suffix)}$`));
});

Then('the webview pathname ends with {string}', async ({ electronApp }, suffix: string) => {
  const page = new LinkTestsPage(electronApp.window);
  await expect.poll(() => page.webviewPathname(), { timeout: LONG_TIMEOUT }).toMatch(new RegExp(`${escapeRegex(suffix)}$`));
});

/**
 * Read window.location.pathname from the link-tests webview, including when it
 * is backgrounded (parent container has display:none). Filters webviews by
 * their `partition` attribute, which the host sets to
 * `sandbox-app-<encoded-identifier>` (buildSandboxPartition) — that's the only stable signal that survives
 * `<aria-hidden="true">` flips and lets us pick the right tab when the
 * dashboard has remote-widget webviews of its own.
 */
async function readBackgroundedPathname(window: Page, identifier: string): Promise<string | null> {
  return window.evaluate(async id => {
    type Wv = HTMLElement & {
      executeJavaScript: (code: string) => Promise<unknown>;
      getURL: () => string;
      getAttribute: (name: string) => string | null;
    };

    const expectedPartition = `sandbox-app-${encodeURIComponent(id)}`;
    const all = Array.from(document.querySelectorAll<Wv>('webview'));
    const candidates = all.filter(wv => wv.getAttribute('partition') === expectedPartition);
    if (candidates.length === 0) return null;

    for (const wv of candidates) {
      try {
        const p = await wv.executeJavaScript('window.location.pathname');
        if (typeof p === 'string') return p;
      } catch {
        // Hidden/frozen guest may reject — keep trying.
      }
    }
    return null;
  }, identifier);
}

/**
 * Fire a `history.pushState` inside the backgrounded link-tests webview by
 * matching the partition — the only stable identifier that survives
 * `display:none` toggles. Throws if the matching webview isn't found so the
 * test surface fails loud instead of silently no-op'ing.
 */
async function fireBackgroundedPushState(window: Page, identifier: string, path: string): Promise<void> {
  await window.evaluate(
    async ({ id, p }) => {
      type Wv = HTMLElement & {
        executeJavaScript: (code: string) => Promise<unknown>;
        getAttribute: (name: string) => string | null;
      };

      const expectedPartition = `sandbox-app-${encodeURIComponent(id)}`;
      const all = Array.from(document.querySelectorAll<Wv>('webview'));
      const target = all.find(wv => wv.getAttribute('partition') === expectedPartition);
      if (!target) throw new Error(`No webview with partition ${expectedPartition}`);
      await target.executeJavaScript(`window.__linkTests.pushNow(${JSON.stringify(p)})`);
    },
    { id: identifier, p: path },
  );
}
