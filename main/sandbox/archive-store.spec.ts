import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createArchiveStore } from './archive-store';

let baseDir: string;
let store: ReturnType<typeof createArchiveStore>;

const enc = new TextEncoder();
const files = { 'index.html': enc.encode('<h1>hi</h1>'), 'a/b.js': enc.encode('export const x = 1') };

beforeEach(async () => {
  baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'archive-store-'));
  store = createArchiveStore(baseDir);
});
afterEach(async () => {
  await fs.rm(baseDir, { recursive: true, force: true });
});

describe('archiveStore', () => {
  it('persists and reads back files + origin by contenthash', async () => {
    await store.persist('app.foo.dot', '0xaa', 'polkadot://app.foo.dot', files);
    expect(await store.has('app.foo.dot', '0xaa')).toBe(true);
    const read = await store.read('app.foo.dot', '0xaa');
    expect(read?.origin).toBe('polkadot://app.foo.dot');
    expect(new TextDecoder().decode(read?.files['index.html'])).toBe('<h1>hi</h1>');
    expect(new TextDecoder().decode(read?.files['a/b.js'])).toBe('export const x = 1');
  });

  it('readCurrent resolves the active version without a contenthash', async () => {
    await store.persist('app.foo.dot', '0xaa', 'polkadot://app.foo.dot', files);
    const current = await store.readCurrent('app.foo.dot');
    expect(current?.origin).toBe('polkadot://app.foo.dot');
    expect(Object.keys(current?.files ?? {}).sort()).toEqual(['a/b.js', 'index.html']);
  });

  it('re-persist with a new contenthash retires the old version', async () => {
    await store.persist('app.foo.dot', '0xaa', 'polkadot://app.foo.dot', files);
    await store.persist('app.foo.dot', '0xbb', 'polkadot://app.foo.dot', files);
    expect(await store.has('app.foo.dot', '0xbb')).toBe(true);
    expect(await store.has('app.foo.dot', '0xaa')).toBe(false);
    expect((await store.readCurrent('app.foo.dot')) !== null).toBe(true);
    // read() of the retired (non-current) version resolves to null, not a
    // blank-origin archive.
    expect(await store.read('app.foo.dot', '0xaa')).toBeNull();
  });

  it('list ignores stray non-directory entries in the base dir', async () => {
    await store.persist('app.foo.dot', '0xaa', 'polkadot://app.foo.dot', files);
    // A macOS-style stray file whose name is not a valid percent-encoding must
    // not crash list() via decodeURIComponent.
    await fs.writeFile(path.join(baseDir, '.DS_Store'), 'junk');
    const list = await store.list();
    expect(list).toEqual([{ domain: 'app.foo.dot', contenthash: '0xaa', sizeBytes: expect.any(Number) }]);
  });

  it('delete removes the whole domain; list reports persisted entries', async () => {
    await store.persist('app.foo.dot', '0xaa', 'polkadot://app.foo.dot', files);
    const list = await store.list();
    expect(list).toEqual([{ domain: 'app.foo.dot', contenthash: '0xaa', sizeBytes: expect.any(Number) }]);
    await store.delete('app.foo.dot');
    expect(await store.has('app.foo.dot', '0xaa')).toBe(false);
    expect(await store.list()).toEqual([]);
  });

  it('readManifest returns origin + file paths (no contents); readFile returns one file', async () => {
    await store.persist('app.foo.dot', '0xaa', 'polkadot://app.foo.dot', files);

    const manifest = await store.readManifest('app.foo.dot', '0xaa');
    expect(manifest?.origin).toBe('polkadot://app.foo.dot');
    expect(manifest?.paths.sort()).toEqual(['a/b.js', 'index.html']);

    const file = await store.readFile('app.foo.dot', '0xaa', 'a/b.js');
    expect(new TextDecoder().decode(file ?? new Uint8Array())).toBe('export const x = 1');

    // Non-current contenthash and absent file both resolve to null.
    expect(await store.readManifest('app.foo.dot', '0xbb')).toBeNull();
    expect(await store.readFile('app.foo.dot', '0xaa', 'missing.js')).toBeNull();
  });

  it('readFile refuses path traversal outside the version dir', async () => {
    await store.persist('app.foo.dot', '0xaa', 'polkadot://app.foo.dot', files);
    expect(await store.readFile('app.foo.dot', '0xaa', '../current.json')).toBeNull();
    expect(await store.readFile('app.foo.dot', '0xaa', '../../escape')).toBeNull();
  });

  it('has() is false when the version dir exists but current.json does not (persist crash-window)', async () => {
    await store.persist('app.foo.dot', '0xaa', 'polkadot://app.foo.dot', files);
    // Simulate a crash between the version-dir rename and the current.json write.
    await fs.rm(path.join(baseDir, encodeURIComponent('app.foo.dot'), 'current.json'), { force: true });
    expect(await store.has('app.foo.dot', '0xaa')).toBe(false);
    expect(await store.readCurrent('app.foo.dot')).toBeNull();
  });

  it('clearAll wipes everything; read of absent returns null', async () => {
    await store.persist('app.foo.dot', '0xaa', 'polkadot://app.foo.dot', files);
    await store.clearAll();
    expect(await store.read('app.foo.dot', '0xaa')).toBeNull();
    expect(await store.readCurrent('app.foo.dot')).toBeNull();
  });
});
