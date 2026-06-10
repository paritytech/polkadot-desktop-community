import { type HexString } from '@/shared/types';

import { type RootManifest } from './schemas';
import { manifestService } from './service';
import { type AppExecutable } from './types';

const TEST_HASH: HexString = '0xdeadbeef';

describe('parseRootManifest', () => {
  test('parses a valid v1 root manifest', () => {
    const raw = JSON.stringify({
      $v: 1,
      displayName: 'HackM3',
      description: 'a test product',
      icon: { cid: 'bafy123', format: 'png' },
    });
    expect(manifestService.parseRootManifest(raw)).toEqual({
      $v: 1,
      displayName: 'HackM3',
      description: 'a test product',
      icon: { cid: 'bafy123', format: 'png' },
    });
  });

  test('returns null for empty text record', () => {
    expect(manifestService.parseRootManifest('')).toBeNull();
  });

  test('returns null for malformed JSON', () => {
    expect(manifestService.parseRootManifest('not json')).toBeNull();
  });

  test('returns null for unknown $v', () => {
    const raw = JSON.stringify({
      $v: 2,
      displayName: 'HackM3',
      description: 'a',
      icon: { cid: 'bafy', format: 'png' },
    });
    expect(manifestService.parseRootManifest(raw)).toBeNull();
  });

  // An unknown `icon.format` degrades the icon to a placeholder but the product
  // stays launchable — so the root manifest must still parse, preserving the raw
  // format string for the render-time guard.
  test('parses root manifest with unknown icon.format (icon degrades to placeholder)', () => {
    const raw = JSON.stringify({
      $v: 1,
      displayName: 'HackM3',
      description: 'a',
      icon: { cid: 'bafy', format: 'svg' },
    });
    expect(manifestService.parseRootManifest(raw)).toEqual({
      $v: 1,
      displayName: 'HackM3',
      description: 'a',
      icon: { cid: 'bafy', format: 'svg' },
    });
  });

  test('returns null when missing required field', () => {
    const raw = JSON.stringify({
      $v: 1,
      displayName: 'HackM3',
      icon: { cid: 'bafy', format: 'png' },
    });
    expect(manifestService.parseRootManifest(raw)).toBeNull();
  });
});

describe('parseExecutableManifest', () => {
  test('parses a valid app manifest under app subname', () => {
    const raw = JSON.stringify({ $v: 1, kind: 'app', appVersion: [1, 0, 0] });
    expect(manifestService.parseExecutableManifest(raw, 'app')).toEqual({
      $v: 1,
      kind: 'app',
      appVersion: [1, 0, 0],
    });
  });

  test('accepts 4-element SemVer tuple with build identifier', () => {
    const raw = JSON.stringify({ $v: 1, kind: 'app', appVersion: [1, 0, 0, 'abc123'] });
    expect(manifestService.parseExecutableManifest(raw, 'app')).toEqual({
      $v: 1,
      kind: 'app',
      appVersion: [1, 0, 0, 'abc123'],
    });
  });

  test('parses a valid widget manifest', () => {
    const raw = JSON.stringify({
      $v: 1,
      kind: 'widget',
      appVersion: [1, 0, 0],
      dimensions: { height: [2, 4, 8] },
    });
    const parsed = manifestService.parseExecutableManifest(raw, 'widget');
    expect(parsed).toEqual({
      $v: 1,
      kind: 'widget',
      appVersion: [1, 0, 0],
      dimensions: { height: [2, 4, 8] },
    });
  });

  test('parses a valid worker manifest with chat only', () => {
    const raw = JSON.stringify({
      $v: 1,
      kind: 'worker',
      appVersion: [1, 0, 0],
      entrypoint: 'index.js',
      includes: { chat: true, pocket: false },
    });
    expect(manifestService.parseExecutableManifest(raw, 'worker')).toEqual({
      $v: 1,
      kind: 'worker',
      appVersion: [1, 0, 0],
      entrypoint: 'index.js',
      includes: { chat: true, pocket: false },
    });
  });

  // A worker with both `includes` false is a valid background-only worker
  // (no Pocket/Chat surface); it still launches, so it must parse.
  test('parses worker with both includes false (background-only worker)', () => {
    const raw = JSON.stringify({
      $v: 1,
      kind: 'worker',
      appVersion: [1, 0, 0],
      entrypoint: 'index.js',
      includes: { chat: false, pocket: false },
    });
    expect(manifestService.parseExecutableManifest(raw, 'worker')).toEqual({
      $v: 1,
      kind: 'worker',
      appVersion: [1, 0, 0],
      entrypoint: 'index.js',
      includes: { chat: false, pocket: false },
    });
  });

  test('rejects manifest whose kind does not match the subname (app under worker subname)', () => {
    const raw = JSON.stringify({ $v: 1, kind: 'app', appVersion: [1, 0, 0] });
    expect(manifestService.parseExecutableManifest(raw, 'worker')).toBeNull();
  });

  test('returns null for empty text record', () => {
    expect(manifestService.parseExecutableManifest('', 'app')).toBeNull();
  });

  test('returns null for malformed JSON', () => {
    expect(manifestService.parseExecutableManifest('not json', 'app')).toBeNull();
  });

  test('returns null for unknown kind', () => {
    const raw = JSON.stringify({ $v: 1, kind: 'mystery', appVersion: [1, 0, 0] });
    expect(manifestService.parseExecutableManifest(raw, 'app')).toBeNull();
  });
});

describe('isRenderableIconFormat', () => {
  test('accepts the v1 raster formats', () => {
    expect(manifestService.isRenderableIconFormat('png')).toBe(true);
    expect(manifestService.isRenderableIconFormat('jpeg')).toBe(true);
    expect(manifestService.isRenderableIconFormat('PNG')).toBe(true);
    expect(manifestService.isRenderableIconFormat('JPEG')).toBe(true);
  });

  test('rejects unknown formats so the icon falls back to a placeholder', () => {
    expect(manifestService.isRenderableIconFormat('svg')).toBe(false);
    expect(manifestService.isRenderableIconFormat('')).toBe(false);
  });
});

describe('assembleProduct', () => {
  test('combines root + executables + owner into a Product struct', () => {
    const root: RootManifest = {
      $v: 1,
      displayName: 'HackM3',
      description: 'a test product',
      icon: { cid: 'bafy123', format: 'png' },
    };
    const app: AppExecutable = { kind: 'app', identifier: 'hackm3.dot', appVersion: [1, 0, 0], contenthash: TEST_HASH };

    expect(
      manifestService.assembleProduct({
        baseName: 'hackm3.dot',
        root,
        executables: { app },
        owner: '0xabc',
      }),
    ).toEqual({
      baseName: 'hackm3.dot',
      displayName: 'HackM3',
      description: 'a test product',
      icon: { cid: 'bafy123', format: 'png' },
      executables: { app },
      owner: '0xabc',
    });
  });
});
