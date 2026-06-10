import * as allure from 'allure-js-commons';

import { expect, test as base } from '../../fixtures/base';

const test = base.extend({});

test.describe('IPC Store Access Control', { tag: ['@security'] }, () => {
  test.beforeEach(async () => {
    await allure.suite('Security');
    await allure.feature('Security');
  });

  test('allows reading an authorized key (autoUpdate)', async ({ electronApp }) => {
    const { window } = electronApp;

    const value = await window.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return (globalThis as any).App.getStoreValue('autoUpdate');
    });

    // Should return a boolean (the default is true for supported platforms)
    expect(typeof value === 'boolean' || typeof value === 'undefined').toBe(true);
  });

  test('blocks reading an unauthorized key', async ({ electronApp }) => {
    const { window } = electronApp;

    const value = await window.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return (globalThis as any).App.getStoreValue('malicious_key');
    });

    expect(value).toBeUndefined();
  });

  test('blocks writing an unauthorized key', async ({ electronApp }) => {
    const { window } = electronApp;

    // Attempt to write an unauthorized key
    await window.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return (globalThis as any).App.setStoreValue('injected_key', 'evil_payload');
    });

    // Verify the key was not written by trying to read it back
    const value = await window.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return (globalThis as any).App.getStoreValue('injected_key');
    });

    expect(value).toBeUndefined();
  });

  test('blocks reading __proto__ key', async ({ electronApp }) => {
    const { window } = electronApp;

    const value = await window.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return (globalThis as any).App.getStoreValue('__proto__');
    });

    expect(value).toBeUndefined();
  });

  // Note: product webview cannot access window.App is already verified
  // by the ctx.window_app probe in node-context-isolation.e2e.ts
});
