import path from 'path';
import { fileURLToPath } from 'url';

import * as allure from 'allure-js-commons';

import { expect, test } from '../../fixtures/base';
import { readProductFiles } from '../../fixtures/security';
import { evaluateInWebview, injectAndLoadProduct } from '../../helpers/webview';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Sandbox Lifecycle — forgetAndReset', { tag: ['@security'] }, () => {
  test.beforeEach(async () => {
    await allure.suite('Security');
    await allure.feature('Security');
  });

  test('clearProductSandboxData wipes localStorage in the partition', async ({ electronApp }) => {
    const { window } = electronApp;
    const productId = 'lifecycle-probe.test';
    const probePath = path.resolve(__dirname, '../../test-products/lifecycle-probe');
    const files = readProductFiles(probePath);

    // Use the app's real partition format (sandbox-app-<id>) so the webview lives in the
    // same partition that clearProductSandboxData targets — otherwise the wipe clears a
    // partition that was never configured and the marker survives.
    const partition = `sandbox-app-${encodeURIComponent(productId)}`;

    await injectAndLoadProduct(window, productId, files, partition);
    await evaluateInWebview(window, `localStorage.setItem('wipe-marker', 'pre-wipe')`);

    const before = await evaluateInWebview<string | null>(window, `localStorage.getItem('wipe-marker')`);
    expect(before).toBe('pre-wipe');

    type WithApp = { App: { clearProductSandboxData: (id: string) => Promise<void> } };
    await window.evaluate(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (id: string) => (globalThis as unknown as WithApp).App.clearProductSandboxData(id),
      productId,
    );

    // clearProductSandboxData also evicts the archive cache, so we must re-save it
    // before the webview can serve the page again.
    await injectAndLoadProduct(window, productId, files, partition);

    const after = await evaluateInWebview<string | null>(window, `localStorage.getItem('wipe-marker')`);
    expect(after).toBeNull();
  });
});
