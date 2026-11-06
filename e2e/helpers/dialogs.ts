import { type Page } from '@playwright/test';

import { TEST_IDS } from '@/shared/test-ids';

/**
 * Approve buttons a `@manual-permissions` test takes over: the dialogs those tests
 * are *about*. Since TrUAPI 0.18 the core's device/remote prompt and the host's own
 * remote-URL grant are one surface, so one id answers both.
 *
 * Allow Always, not Allow Once: `permission-settings.feature` is deliberately not
 * `@manual-permissions` and asserts that an auto-approved app appears in Settings →
 * Privacy, a list built from persisted core-storage permission slots. A one-shot
 * grant writes no slot.
 */
const GATED_APPROVE_TESTIDS = [TEST_IDS.permissionDialogAllowAlways, TEST_IDS.aliasPermissionAllow];

/**
 * Approve buttons that are answered even under `@manual-permissions`.
 *
 * Before it can serve a signing, alias or permission request the core may first ask the
 * paired device for the product's own account subtree ("Allow this app to access its
 * account?"). That prompt is a preamble to the request a scenario actually drives, not the
 * subject of any scenario, and leaving it up puts a modal overlay in front of every one of
 * them. Opting out of the auto-approver means "let me drive the dialog under test", not
 * "let me answer the core's preamble in every scenario".
 *
 * `identityDisclosureAllow` is the same shape: a product asks for the user's primary username
 * (`account.get_user_id`) before the flow under test, and paritytech/polkadot-desktop-community#55
 * reports that the product SDK signer does so on connect. `accountAccessAllow` (one product
 * borrowing another's account) rides along too — no scenario asserts on either, and both block
 * the same way.
 */
const ALWAYS_APPROVE_TESTIDS = [TEST_IDS.productSubtreeAllow, TEST_IDS.identityDisclosureAllow, TEST_IDS.accountAccessAllow];

/**
 * localStorage key whose value gates the auto-approver at runtime. Value `'0'`
 * disables it; any other value (or absence) keeps it enabled. Read live on
 * every candidate node, so the gate can be flipped per-test on a shared page
 * (worker-scoped authenticated session) without reinstalling the observer.
 *
 * `setDialogAutoApprove` runs after the per-test storage reset and before the
 * reload (`reset-state.ts`), so the observer — re-installed by `addInitScript`
 * on reload — reads the value the test set for it.
 */
const AUTO_APPROVE_FLAG_KEY = '__e2e_dialog_auto_approve';

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
 * Whether a click actually fires is gated by the `AUTO_APPROVE_FLAG_KEY`
 * localStorage value, read live on every candidate node (default: enabled) —
 * but only for `GATED_APPROVE_TESTIDS`; `ALWAYS_APPROVE_TESTIDS` are answered
 * whatever the gate says.
 * On a fresh-per-test app the observer is only installed when the test isn't
 * `@manual-permissions`, so the gate stays at its default. On the shared
 * worker-scoped authenticated page the observer is installed once and the
 * per-test soft-reset flips the gate via `setDialogAutoApprove` — installing
 * for normal tests, disabling for `@manual-permissions` — so state never
 * bleeds across tests on the shared page.
 *
 * Some of these ids sit on the `<button>` itself and others on a wrapper div, so
 * the lookup accepts either. Where it is a wrapper, the inner `<button>` is
 * targeted rather than the wrapper, because the wrapper takes its width from the
 * surrounding flex layout and on Windows its center can land in padding, so a
 * click would miss the button.
 */
export async function registerProductDialogHandlers(page: Page) {
  const installAutoApprover = ({
    gatedTestIds,
    alwaysTestIds,
    flagKey,
  }: {
    gatedTestIds: readonly string[];
    alwaysTestIds: readonly string[];
    flagKey: string;
  }) => {
    const flag = '__e2eAutoApproveInstalled';
    if (Reflect.get(window, flag)) return;
    Reflect.set(window, flag, true);

    const toSelector = (ids: readonly string[]) => ids.map(id => `[data-testid="${id}"]`).join(',');
    const gatedSelector = toSelector(gatedTestIds);
    const alwaysSelector = toSelector(alwaysTestIds);
    const selector = `${gatedSelector},${alwaysSelector}`;

    const enabled = () => {
      try {
        return localStorage.getItem(flagKey) !== '0';
      } catch {
        return true;
      }
    };

    const click = (node: Element) => {
      if (node.matches(gatedSelector) && !enabled()) return;
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

  const arg = {
    gatedTestIds: GATED_APPROVE_TESTIDS,
    alwaysTestIds: ALWAYS_APPROVE_TESTIDS,
    flagKey: AUTO_APPROVE_FLAG_KEY,
  };
  await page.addInitScript(installAutoApprover, arg);
  await page.evaluate(installAutoApprover, arg).catch(() => {});
}

/**
 * Flip the auto-approver gate for the shared worker-scoped page. Writes the
 * `AUTO_APPROVE_FLAG_KEY` localStorage value the installed observer reads.
 * Call before the soft-reset reload so the value is in place when the
 * `addInitScript`-reinstalled observer comes up after the reload.
 */
export async function setDialogAutoApprove(page: Page, enabled: boolean): Promise<void> {
  await page
    .evaluate(
      ({ key, value }) => {
        try {
          localStorage.setItem(key, value);
        } catch {
          // opaque origin / storage unavailable — best-effort
        }
      },
      { key: AUTO_APPROVE_FLAG_KEY, value: enabled ? '1' : '0' },
    )
    .catch(() => {});
}
