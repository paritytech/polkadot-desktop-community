import * as allure from 'allure-js-commons';

import { expect, securityTest as test } from '../../fixtures/security';

test.describe('Storage Isolation', { tag: ['@security'] }, () => {
  test.beforeEach(async () => {
    await allure.suite('Security');
    await allure.feature('Security');
  });

  test('localStorage is accessible within partition', async ({ probeResults }) => {
    const result = probeResults['store.localstorage'];
    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.actual).toBe('accessible');
  });

  test('sessionStorage is accessible within partition', async ({ probeResults }) => {
    const result = probeResults['store.sessionstorage'];
    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.actual).toBe('accessible');
  });

  test('IndexedDB is accessible within partition', async ({ probeResults }) => {
    const result = probeResults['store.indexeddb'];
    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.actual).toBe('accessible');
  });

  test('cookies are accessible or scheme-limited on polkadot://', async ({ probeResults }) => {
    const result = probeResults['store.cookie'];
    expect(result).toBeDefined();
    // polkadot:// custom scheme doesn't support document.cookie,
    // so the probe reports 'scheme-limited' instead of 'accessible'.
    // Either result is acceptable — the important thing is it doesn't error.
    expect(result?.passed).toBe(true);
    expect(result?.actual).toMatch(/^(accessible|scheme-limited)/);
  });

  test('host app IndexedDB is not accessible from product partition', async ({ probeResults }) => {
    const result = probeResults['store.host_db'];
    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.actual).toContain('empty');
  });
});
