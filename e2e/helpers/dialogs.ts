import { type Page } from '@playwright/test';

import { TEST_IDS } from '@/shared/test-ids';

const APPROVE_TESTIDS = [TEST_IDS.permissionDialogAllowAlways, TEST_IDS.aliasPermissionAllow];

/**
 * Auto-approve transient permission/alias dialogs in the renderer.
 *
 * Installs a MutationObserver via `addInitScript` (runs on every navigation)
 * and once immediately via `evaluate` (covers the already-loaded document).
 * Watches `document.body` for any element matching one of the approve
 * test-ids and clicks the inner `<button>` as soon as it appears. Fires
 * independently of Playwright actions — works even while the test is doing
 * non-interactive work like cycling through tabs.
 *
 * "Always Allow" is preferred over "Allow Once" so the same product+permission
 * doesn't re-prompt within a test. Cross-test contamination is not a concern —
 * `clearAppData()` runs before every test (see `e2e/CLAUDE.md` "Rules").
 *
 * The inner `<button>` is targeted (not the wrapper div the test-id sits on)
 * because the wrapper takes its width from the surrounding flex layout, so on
 * Windows its center can land in padding and a click misses the button.
 */
export async function registerProductDialogHandlers(page: Page) {
  const installAutoApprover = (testIds: readonly string[]) => {
    const flag = '__e2eAutoApproveInstalled';
    if (Reflect.get(window, flag)) return;
    Reflect.set(window, flag, true);

    const selector = testIds.map(id => `[data-testid="${id}"]`).join(',');

    const click = (node: Element) => {
      const button = node.matches('button') ? node : node.querySelector('button');
      if (button instanceof HTMLButtonElement) button.click();
    };

    const scan = (root: ParentNode) => {
      for (const node of root.querySelectorAll(selector)) click(node);
    };

    const start = () => {
      scan(document.body);
      new MutationObserver(records => {
        for (const record of records) {
          for (const added of record.addedNodes) {
            if (!(added instanceof Element)) continue;
            if (added.matches(selector)) click(added);
            scan(added);
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    };

    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
  };

  await page.addInitScript(installAutoApprover, APPROVE_TESTIDS);
  await page.evaluate(installAutoApprover, APPROVE_TESTIDS).catch(() => {});
}
