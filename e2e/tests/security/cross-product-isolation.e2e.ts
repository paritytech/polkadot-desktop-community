import path from 'path';
import { fileURLToPath } from 'url';

import { type Page } from '@playwright/test';
import * as allure from 'allure-js-commons';

import { expect, test as base } from '../../fixtures/base';
import { readProductFiles } from '../../fixtures/security';
import { evaluateInWebview, injectAndLoadProduct } from '../../helpers/webview';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function waitForConsoleMessage(window: Page, prefix: string, timeoutMs = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout waiting for ${prefix}`)), timeoutMs);

    const handler = (msg: { text: () => string }) => {
      const text = msg.text();
      if (text.includes(prefix)) {
        clearTimeout(timeout);
        window.removeListener('console', handler);
        resolve(text.substring(text.indexOf(prefix) + prefix.length));
      }
    };

    window.on('console', handler);
  });
}

const test = base.extend({});

test.describe('Cross-Product Storage Isolation', { tag: ['@security'] }, () => {
  test.beforeEach(async () => {
    await allure.suite('Security');
    await allure.feature('Security');
  });

  test('browser-level localStorage is isolated between products', async ({ electronApp }) => {
    const { window } = electronApp;
    const productAPath = path.resolve(__dirname, '../../test-products/cross-product-a');
    const productBPath = path.resolve(__dirname, '../../test-products/cross-product-b');

    // Inject and load Product A
    const readyPromise = waitForConsoleMessage(window, 'CROSS_PRODUCT_A_READY');
    const filesA = readProductFiles(productAPath);
    await injectAndLoadProduct(window, 'product-a.test', filesA);
    await readyPromise;

    // Verify Product A wrote its data
    const productASecret = await evaluateInWebview<string | null>(window, `localStorage.getItem('secret')`);
    expect(productASecret).toBe('product-a-data');

    // Now inject and load Product B (different partition)
    const resultsPromise = waitForConsoleMessage(window, 'CROSS_PRODUCT_B_RESULTS::');
    const filesB = readProductFiles(productBPath);
    await injectAndLoadProduct(window, 'product-b.test', filesB);
    const resultsJson = await resultsPromise;
    const results = JSON.parse(resultsJson);

    // Product B should NOT see Product A's data — partitions are isolated
    expect(results.localStorage).toBeNull();
    expect(results.localStorageProductId).toBeNull();
    expect(results.sessionStorage).toBeNull();
    expect(results.cookie).toBeNull();
    expect(results.indexedDB).toBeNull();
  });

  test('direct webview localStorage read returns null for other product data', async ({ electronApp }) => {
    const { window } = electronApp;
    const productBPath = path.resolve(__dirname, '../../test-products/cross-product-b');

    // Just load Product B without loading Product A first
    const resultsPromise = waitForConsoleMessage(window, 'CROSS_PRODUCT_B_RESULTS::');
    const filesB = readProductFiles(productBPath);
    await injectAndLoadProduct(window, 'product-b.test', filesB);
    const resultsJson = await resultsPromise;
    const results = JSON.parse(resultsJson);

    // Fresh partition should have no data
    expect(results.localStorage).toBeNull();
    expect(results.cookie).toBeNull();
    expect(results.indexedDB).toBeNull();
  });

  test('webview elements get per-product partition attributes', async ({ electronApp }) => {
    const { window } = electronApp;
    const productAPath = path.resolve(__dirname, '../../test-products/cross-product-a');

    const filesA = readProductFiles(productAPath);
    await injectAndLoadProduct(window, 'product-a.test', filesA);

    // Verify the webview has the correct per-product partition
    const partition = await window.evaluate(() => {
      const wv = document.querySelector('#test-webview');
      return wv?.getAttribute('partition');
    });

    expect(partition).toBe('sandbox-product-a.test');
  });
});
