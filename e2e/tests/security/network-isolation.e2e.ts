import * as allure from 'allure-js-commons';

import { expect, securityTest as test } from '../../fixtures/security';

test.describe('Network Isolation', { tag: ['@security'] }, () => {
  test.beforeEach(async () => {
    await allure.suite('Security');
    await allure.feature('Security');
  });

  test('blocks fetch to HTTPS endpoints', async ({ probeResults }) => {
    const result = probeResults['net.fetch.https'];
    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.actual).toContain('blocked');
  });

  test('blocks fetch to HTTP endpoints', async ({ probeResults }) => {
    const result = probeResults['net.fetch.http'];
    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.actual).toContain('blocked');
  });

  test('blocks XMLHttpRequest to external URLs', async ({ probeResults }) => {
    const result = probeResults['net.xhr'];
    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.actual).toContain('blocked');
  });

  test('blocks WebSocket wss connections', async ({ probeResults }) => {
    const result = probeResults['net.websocket'];
    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.actual).toContain('blocked');
  });

  test('blocks WebSocket ws (plain) connections', async ({ probeResults }) => {
    const result = probeResults['net.websocket.ws'];
    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.actual).toContain('blocked');
  });

  test('blocks EventSource connections', async ({ probeResults }) => {
    const result = probeResults['net.eventsource'];
    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.actual).toContain('blocked');
  });

  test('blocks dynamic script tags from external URLs', async ({ probeResults }) => {
    const result = probeResults['net.script'];
    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.actual).toContain('blocked');
  });

  test('blocks dynamic img tags from external URLs', async ({ probeResults }) => {
    const result = probeResults['net.img'];
    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.actual).toContain('blocked');
  });

  test('blocks dynamic link tags from external URLs', async ({ probeResults }) => {
    const result = probeResults['net.link'];
    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.actual).toContain('blocked');
  });

  test('blocks navigator.sendBeacon', async ({ probeResults }) => {
    const result = probeResults['net.beacon'];
    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.actual).toContain('blocked');
  });

  test('blocks Worker from external URL', async ({ probeResults }) => {
    const result = probeResults['net.worker'];
    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.actual).toContain('blocked');
  });

  test('allows fetch to polkadot:// scheme (sanity check)', async ({ probeResults }) => {
    const result = probeResults['net.fetch.product'];
    expect(result).toBeDefined();
    expect(result?.passed).toBe(true);
    expect(result?.actual).toContain('allowed');
  });
});
