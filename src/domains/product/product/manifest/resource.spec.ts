import { type BehaviorSubject } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';

import { type HexString } from '@/shared/types';

import { archiveCacheKey, executableArchiveResource, invalidateExecutableArchive, peekExecutableArchive } from './resource';
import { type ExecutableContent } from './types';

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- cache$ is a BehaviorSubject internally; cast is safe in tests (see types.ts note)
const archiveCache$ = executableArchiveResource.cache$ as BehaviorSubject<Record<string, ExecutableContent | null>>;

const HASH_A: HexString = '0xaabb';
const HASH_B: HexString = '0xccdd';

describe('archiveCacheKey', () => {
  it('produces distinct keys for the same (baseName, kind) with different contenthashes', () => {
    const key1 = archiveCacheKey('a.dot', 'app', HASH_A);
    const key2 = archiveCacheKey('a.dot', 'app', HASH_B);
    expect(key1).not.toBe(key2);
  });

  it('produces distinct keys for the same (baseName, contenthash) with different kinds', () => {
    const keyApp = archiveCacheKey('a.dot', 'app', HASH_A);
    const keyWorker = archiveCacheKey('a.dot', 'worker', HASH_A);
    expect(keyApp).not.toBe(keyWorker);
  });

  it('produces distinct keys for the same (kind, contenthash) with different baseNames', () => {
    const key1 = archiveCacheKey('a.dot', 'app', HASH_A);
    const key2 = archiveCacheKey('b.dot', 'app', HASH_A);
    expect(key1).not.toBe(key2);
  });

  it('produces the same key for the same (baseName, kind, contenthash)', () => {
    const key1 = archiveCacheKey('a.dot', 'app', HASH_A);
    const key2 = archiveCacheKey('a.dot', 'app', HASH_A);
    expect(key1).toBe(key2);
  });
});

describe('invalidateExecutableArchive', () => {
  it('is callable with a contenthash without throwing', () => {
    expect(() => {
      invalidateExecutableArchive('a.dot', 'app', HASH_A);
    }).not.toThrow();
  });

  it('is callable without a contenthash (prefix-eviction form) without throwing', () => {
    expect(() => {
      invalidateExecutableArchive('a.dot', 'app');
    }).not.toThrow();
  });
});

describe('peekExecutableArchive', () => {
  afterEach(() => {
    // Reset the shared resource cache so seeded entries don't leak across tests.
    archiveCache$.next({});
  });

  it('returns null when nothing is cached for the product/kind', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal fixture, only baseName + executables[kind].contenthash are read
    const product = { baseName: 'none.dot', executables: { app: { contenthash: '0xaa' } } } as never;
    expect(peekExecutableArchive(product, 'app')).toBeNull();
  });

  it('returns null when the executable kind is absent', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal fixture for the absent-kind branch
    const product = { baseName: 'none.dot', executables: {} } as never;
    expect(peekExecutableArchive(product, 'worker')).toBeNull();
  });

  it('returns null when the cached entry has no bytes (disk-hit files: {})', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal fixture
    const product = { baseName: 'a.dot', executables: { app: { contenthash: '0xaa' } } } as never;
    archiveCache$.next({
      [archiveCacheKey('a.dot', 'app', '0xaa')]: {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowing string literal to HexString for the fixture
        contenthash: '0xaa' as `0x${string}`,
        archive: { domain: 'app.a.dot', origin: 'polkadot://app.a.dot', files: {} },
      },
    });
    expect(peekExecutableArchive(product, 'app')).toBeNull();
  });

  it('returns the cached entry when bytes are present', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal fixture
    const product = { baseName: 'a.dot', executables: { app: { contenthash: '0xaa' } } } as never;
    const entry = {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowing string literal to HexString for the fixture
      contenthash: '0xaa' as `0x${string}`,
      archive: { domain: 'app.a.dot', origin: 'polkadot://app.a.dot', files: { 'index.html': new Uint8Array([1]) } },
    };
    archiveCache$.next({ [archiveCacheKey('a.dot', 'app', '0xaa')]: entry });
    expect(peekExecutableArchive(product, 'app')).toEqual(entry);
  });
});
