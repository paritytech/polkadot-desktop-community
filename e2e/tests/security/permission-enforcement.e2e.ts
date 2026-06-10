import * as allure from 'allure-js-commons';

import { expect, securityTest as test } from '../../fixtures/security';

test.describe('Permission Enforcement', { tag: ['@security'] }, () => {
  test.beforeEach(async () => {
    await allure.suite('Security');
    await allure.feature('Security');
  });

  test('blocks camera access', async ({ probeResults }) => {
    const result = probeResults['perm.camera'];
    expect(result).toBeDefined();
    expect(result.passed).toBe(true);
    expect(result.actual).toContain('blocked');
  });

  test('blocks microphone access', async ({ probeResults }) => {
    const result = probeResults['perm.microphone'];
    expect(result).toBeDefined();
    expect(result.passed).toBe(true);
    expect(result.actual).toContain('blocked');
  });

  test('blocks geolocation access', async ({ probeResults }) => {
    const result = probeResults['perm.geolocation'];
    expect(result).toBeDefined();
    expect(result.passed).toBe(true);
    expect(result.actual).toContain('blocked');
  });

  test('blocks notification permission', async ({ probeResults }) => {
    const result = probeResults['perm.notification'];
    expect(result).toBeDefined();
    expect(result.passed).toBe(true);
    expect(result.actual).toContain('blocked');
  });

  test('blocks clipboard read', async ({ probeResults }) => {
    const result = probeResults['perm.clipboard.read'];
    expect(result).toBeDefined();
    expect(result.passed).toBe(true);
    expect(result.actual).toContain('blocked');
  });

  test('allows clipboard write (may be context-limited in test)', async ({ probeResults }) => {
    const result = probeResults['perm.clipboard.write'];
    expect(result).toBeDefined();
    // Clipboard write permission is granted by the sandbox, but the API may fail
    // in test context due to missing user gesture or non-HTTPS origin.
    // The probe passes either way — it reports 'allowed' or 'context-limited'.
    expect(result.passed).toBe(true);
    expect(result.actual).toMatch(/^(allowed|context-limited)/);
  });
});
