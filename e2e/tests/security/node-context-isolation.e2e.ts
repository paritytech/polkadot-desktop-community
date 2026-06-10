import * as allure from 'allure-js-commons';

import { expect, securityTest as test } from '../../fixtures/security';

test.describe('Node.js Context Isolation', { tag: ['@security'] }, () => {
  test.beforeEach(async () => {
    await allure.suite('Security');
    await allure.feature('Security');
  });

  test('require is not available', async ({ probeResults }) => {
    const result = probeResults['node.require'];
    expect(result).toBeDefined();
    expect(result.passed).toBe(true);
    expect(result.actual).toBe('undefined');
  });

  test('process is not available', async ({ probeResults }) => {
    const result = probeResults['node.process'];
    expect(result).toBeDefined();
    expect(result.passed).toBe(true);
    expect(result.actual).toBe('undefined');
  });

  test('global is not available', async ({ probeResults }) => {
    const result = probeResults['node.global'];
    expect(result).toBeDefined();
    expect(result.passed).toBe(true);
    expect(result.actual).toBe('undefined');
  });

  test('__dirname is not available', async ({ probeResults }) => {
    const result = probeResults['node.dirname'];
    expect(result).toBeDefined();
    expect(result.passed).toBe(true);
    expect(result.actual).toBe('undefined');
  });

  test('module is not available', async ({ probeResults }) => {
    const result = probeResults['node.module'];
    expect(result).toBeDefined();
    expect(result.passed).toBe(true);
    expect(result.actual).toBe('undefined');
  });

  test('window.App (host preload) is not exposed to products', async ({ probeResults }) => {
    const result = probeResults['ctx.window_app'];
    expect(result).toBeDefined();
    expect(result.passed).toBe(true);
    expect(result.actual).toBe('undefined');
  });

  test('__HOST_WEBVIEW_MARK__ is exposed (sandbox preload)', async ({ probeResults }) => {
    const result = probeResults['ctx.webview_mark'];
    expect(result).toBeDefined();
    expect(result.passed).toBe(true);
    expect(result.actual).toContain('exists');
  });

  test('electron module is not accessible', async ({ probeResults }) => {
    const result = probeResults['ctx.ipc_renderer'];
    expect(result).toBeDefined();
    expect(result.passed).toBe(true);
    expect(result.actual).toContain('blocked');
  });
});
