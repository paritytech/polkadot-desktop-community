import * as allure from 'allure-js-commons';

import { expect, securityTest as test } from '../../fixtures/security';

test.describe('Navigation Restriction', { tag: ['@security'] }, () => {
  test.beforeEach(async () => {
    await allure.suite('Security');
    await allure.feature('Security');
  });

  test('blocks window.open to external URLs', async ({ probeResults }) => {
    const result = probeResults['nav.window_open'];
    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.actual).toContain('denied');
  });

  test('blocks data URI navigation', async ({ probeResults }) => {
    const result = probeResults['nav.data_uri'];
    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.actual).toContain('blocked');
  });

  test('blocks javascript: URI', async ({ probeResults }) => {
    const result = probeResults['nav.javascript_uri'];
    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.actual).toContain('blocked');
  });

  test('allows navigation within polkadot:// scheme', async ({ probeResults }) => {
    const result = probeResults['nav.product_internal'];
    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.actual).toBe('allowed');
  });
});

test.describe('Side Channel Probes', { tag: ['@security'] }, () => {
  test.beforeEach(async () => {
    await allure.suite('Security');
    await allure.feature('Security');
  });

  test('SharedArrayBuffer is not available', async ({ probeResults }) => {
    const result = probeResults['timing.shared_array_buffer'];
    expect(result).toBeDefined();
    // SharedArrayBuffer may or may not be available depending on headers — informational
    expect(result?.passed).toBe(true);
  });

  test('performance.now() precision (informational)', async ({ probeResults }) => {
    const result = probeResults['timing.perf_precision'];
    expect(result).toBeDefined();
    // Always passes — just reports precision
    expect(result?.passed).toBe(true);
    expect(result?.actual).toContain('informational');
  });

  test('measureUserAgentSpecificMemory is blocked', async ({ probeResults }) => {
    const result = probeResults['timing.memory'];
    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.actual).toContain('blocked');
  });
});
