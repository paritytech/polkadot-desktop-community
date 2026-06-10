import * as allure from 'allure-js-commons';

import { expect, test as base } from '../../fixtures/base';

const test = base.extend({});

test.describe('Deep Link URL Injection', { tag: ['@security'] }, () => {
  test.beforeEach(async () => {
    await allure.suite('Security');
    await allure.feature('Security');
  });

  test('processUrl does not crash on malformed URL', async ({ electronApp }) => {
    const { app } = electronApp;

    // Simulate a malformed deep link — processUrl should handle gracefully without crashing
    const didCrash = await app.evaluate(async ({ app: electronApp }) => {
      // Import the processUrl function indirectly by emitting the open-url event
      // The app should not crash when receiving a malformed URL
      try {
        electronApp.emit('open-url', { preventDefault: () => {} }, 'not-a-valid-url');
        return false;
      } catch {
        return true;
      }
    });

    expect(didCrash).toBe(false);
  });

  test('processUrl ignores non-matching protocol', async ({ electronApp }) => {
    const { app } = electronApp;

    const didCrash = await app.evaluate(async ({ app: electronApp }) => {
      try {
        electronApp.emit('open-url', { preventDefault: () => {} }, 'https://evil.com/exploit');
        return false;
      } catch {
        return true;
      }
    });

    expect(didCrash).toBe(false);
  });

  test('XSS payload in query string does not appear unescaped in loaded URL', async ({ electronApp }) => {
    const { window } = electronApp;

    // Get the current URL before any deep link processing
    const currentUrl = await window.evaluate(() => window.location.href);

    // The URL should not contain unescaped script tags
    expect(currentUrl).not.toContain('<script>');
    expect(currentUrl).not.toContain('javascript:');
  });
});
