import * as allure from 'allure-js-commons';

import { expect, test as base } from '../../fixtures/base';

const test = base.extend({});

test.describe('Content Security Policy Enforcement', { tag: ['@security'] }, () => {
  test.beforeEach(async () => {
    await allure.suite('Security');
    await allure.feature('Security');
  });

  test('CSP meta tag is present with restrictive directives', async ({ electronApp }) => {
    const { window } = electronApp;

    const csp = await window.evaluate(() => {
      const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      return meta?.getAttribute('content') ?? null;
    });

    expect(csp).not.toBeNull();
    // Verify key directives are present
    expect(csp).toContain("img-src 'self' data: blob: https://raw.githubusercontent.com");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("default-src 'self'");
  });

  test('object-src none blocks plugin embeds', async ({ electronApp }) => {
    const { window } = electronApp;

    const csp = await window.evaluate(() => {
      const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      return meta?.getAttribute('content') ?? '';
    });

    expect(csp).toContain("object-src 'none'");
  });

  test('script-src restricts inline scripts', async ({ electronApp }) => {
    const { window } = electronApp;

    const csp = await window.evaluate(() => {
      const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      return meta?.getAttribute('content') ?? '';
    });

    // script-src should not include 'unsafe-inline' or 'unsafe-eval' (but 'wasm-unsafe-eval' is acceptable)
    const scriptSrc = csp.match(/script-src\s+([^;]+)/)?.[1] ?? '';
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  test('frame-src allows polkadot:// scheme', async ({ electronApp }) => {
    const { window } = electronApp;

    const csp = await window.evaluate(() => {
      const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      return meta?.getAttribute('content') ?? '';
    });

    expect(csp).toContain('frame-src');
    expect(csp).toContain('polkadot:');
  });
});
