import * as allure from 'allure-js-commons';

import { expect, test as base } from '../../fixtures/base';

const test = base.extend({});

test.describe('Archive Injection Protection', { tag: ['@security'] }, () => {
  test.beforeEach(async () => {
    await allure.suite('Security');
    await allure.feature('Security');
  });

  test('rejects archive with empty string domain', async ({ electronApp }) => {
    const { window } = electronApp;

    const result = await window.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return (globalThis as any).App.saveArchive({
        domain: '',
        origin: 'polkadot://',
        files: { 'index.html': new Uint8Array([60, 104, 49, 62, 104, 105, 60, 47, 104, 49, 62]) },
      });
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid domain');
  });

  test('rejects archive with null byte in domain', async ({ electronApp }) => {
    const { window } = electronApp;

    const result = await window.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return (globalThis as any).App.saveArchive({
        domain: 'evil\x00.test',
        origin: 'polkadot://evil.test',
        files: { 'index.html': new Uint8Array([60, 104, 49, 62, 104, 105, 60, 47, 104, 49, 62]) },
      });
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid domain characters');
  });

  test('rejects archive with slashes in domain', async ({ electronApp }) => {
    const { window } = electronApp;

    const result = await window.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return (globalThis as any).App.saveArchive({
        domain: '../../../etc/passwd',
        origin: 'polkadot://evil.test',
        files: { 'index.html': new Uint8Array([60, 104, 49, 62, 104, 105, 60, 47, 104, 49, 62]) },
      });
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid domain characters');
  });

  test('rejects archive with path traversal in file keys', async ({ electronApp }) => {
    const { window } = electronApp;

    const result = await window.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return (globalThis as any).App.saveArchive({
        domain: 'legit-product.test',
        origin: 'polkadot://legit-product.test',
        files: { '../../etc/passwd': new Uint8Array([109, 97, 108, 105, 99, 105, 111, 117, 115]) },
      });
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid file path');
  });

  test('rejects archive with absolute file path', async ({ electronApp }) => {
    const { window } = electronApp;

    const result = await window.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return (globalThis as any).App.saveArchive({
        domain: 'legit-product.test',
        origin: 'polkadot://legit-product.test',
        files: { '/etc/passwd': new Uint8Array([109, 97, 108, 105, 99, 105, 111, 117, 115]) },
      });
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid file path');
  });

  test('accepts valid archive with legitimate domain and paths', async ({ electronApp }) => {
    const { window } = electronApp;

    const result = await window.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return (globalThis as any).App.saveArchive({
        domain: 'valid-product.test',
        origin: 'polkadot://valid-product.test',
        files: {
          'index.html': new Uint8Array([60, 104, 49, 62, 111, 107, 60, 47, 104, 49, 62]),
          'assets/style.css': new Uint8Array([98, 111, 100, 121, 123, 125]),
        },
      });
    });

    expect(result.success).toBe(true);
  });
});
