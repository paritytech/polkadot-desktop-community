import 'fake-indexeddb/auto';

import { okAsync } from 'neverthrow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { database } from '@/shared/database';
import { executableCacheRepository } from '../product/executable-cache/repository';
import { archiveGateway } from '../product/manifest/gateway';
import { peekExecutableArchive } from '../product/manifest/resource';
import { type PersistedProduct, productDb } from '../product/repository';
import { type Product } from '../product/types';

import { offlineCacheUseCase } from './offlineCache';
import { resolveProductUseCase } from './resolve';

// peekExecutableArchive is mocked module-wide: default null so existing prefetch
// tests still fall through to the IPFS fetch; one test overrides it per-call.
vi.mock('../product/manifest/resource', () => ({ peekExecutableArchive: vi.fn(() => null) }));

const product: Product = {
  baseName: 'app.dot',
  displayName: 'App',
  description: '',
  icon: { cid: '', format: 'png' },
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test fixture executable
  executables: { app: { kind: 'app', identifier: 'app.app.dot', appVersion: [0, 0, 0], contenthash: '0xaa' } as never },
};

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal window.App stub for the use case
  globalThis.window = {
    App: {
      persistArchive: vi.fn(async () => ({ success: true })),
      deleteArchive: vi.fn(async () => ({ success: true })),
      hasArchive: vi.fn(async () => true),
      listPersistedArchives: vi.fn(async () => []),
    },
  } as never;
});
afterEach(async () => {
  await database.productExecutableCache.clear();
  vi.restoreAllMocks();
});

describe('offlineCacheUseCase.prefetchArchives', () => {
  it('persists each present executable and marks it ready', async () => {
    vi.spyOn(archiveGateway, 'fetchExecutable').mockResolvedValue({
      contenthash: '0xaa',
      archive: { domain: 'app.app.dot', origin: 'polkadot://app.app.dot', files: { 'index.html': new Uint8Array([1]) } },
    });

    await offlineCacheUseCase.prefetchArchives(product);

    expect(window.App.persistArchive).toHaveBeenCalledTimes(1);
    const rows = await executableCacheRepository.getByBaseName('app.dot');
    expect(rows[0]).toEqual(expect.objectContaining({ kind: 'app', status: 'ready', contenthash: '0xaa' }));
  });

  it('marks failed when the fetch fails', async () => {
    vi.spyOn(archiveGateway, 'fetchExecutable').mockResolvedValue(null);
    await offlineCacheUseCase.prefetchArchives(product);
    const rows = await executableCacheRepository.getByBaseName('app.dot');
    expect(rows[0]).toEqual(expect.objectContaining({ status: 'failed' }));
  });

  it('reuses already-cached bytes and skips the IPFS fetch', async () => {
    vi.mocked(peekExecutableArchive).mockReturnValueOnce({
      contenthash: '0xaa',
      archive: { domain: 'app.app.dot', origin: 'polkadot://app.app.dot', files: { 'index.html': new Uint8Array([1, 2]) } },
    });
    const fetchSpy = vi.spyOn(archiveGateway, 'fetchExecutable');

    await offlineCacheUseCase.prefetchArchives(product);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(window.App.persistArchive).toHaveBeenCalledTimes(1);
    const rows = await executableCacheRepository.getByBaseName('app.dot');
    expect(rows[0]).toEqual(expect.objectContaining({ status: 'ready', contenthash: '0xaa' }));
  });
});

describe('offlineCacheUseCase.evictArchives', () => {
  it('deletes disk + index for each kind', async () => {
    await executableCacheRepository.setStatus('app.dot', 'app', 'app.app.dot', '0xaa', 'ready');
    await offlineCacheUseCase.evictArchives('app.dot');
    expect(window.App.deleteArchive).toHaveBeenCalledWith('app.app.dot');
    // Also drops the legacy bare-name archive (legacy app archives live under the base).
    expect(window.App.deleteArchive).toHaveBeenCalledWith('app.dot');
    expect(await executableCacheRepository.getByBaseName('app.dot')).toEqual([]);
  });
});

describe('offlineCacheUseCase.reconcilePinnedArchives', () => {
  it('re-pins products missing bytes and survives a per-product chain rejection', async () => {
    // Bytes missing on disk → every pinned product needs a re-pin.
    window.App.hasArchive = vi.fn(async () => false);

    const persisted = (baseName: string, identifier: string, contenthash: string): PersistedProduct => ({
      ...product,
      baseName,
      pinned: true,
      createdAt: 1,
      updatedAt: 1,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test fixture executable
      executables: { app: { kind: 'app', identifier, appVersion: [0, 0, 0], contenthash } as never },
    });
    const p1 = persisted('p1.dot', 'app.p1.dot', '0xaa');
    const p2 = persisted('p2.dot', 'app.p2.dot', '0xbb');

    vi.spyOn(productDb, 'getAll').mockReturnValue(okAsync([p1, p2]));
    const upsertSpy = vi
      .spyOn(productDb, 'upsert')
      .mockImplementation(fresh => okAsync({ ...fresh, pinned: true, createdAt: 1, updatedAt: 2 }));
    vi.spyOn(resolveProductUseCase, 'fetchProductFromChain').mockImplementation(async (baseName: string) => {
      if (baseName === 'p1.dot') throw new Error('rpc down');
      return p2;
    });
    vi.spyOn(archiveGateway, 'fetchExecutable').mockResolvedValue({
      contenthash: '0xbb',
      archive: { domain: 'app.p2.dot', origin: 'polkadot://app.p2.dot', files: { 'index.html': new Uint8Array([1]) } },
    });

    await offlineCacheUseCase.reconcilePinnedArchives();

    // p1's rejection did not abort the loop; p2 was still re-pinned + prefetched.
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(window.App.persistArchive).toHaveBeenCalled();
    const rows = await executableCacheRepository.getByBaseName('p2.dot');
    expect(rows[0]).toEqual(expect.objectContaining({ status: 'ready', contenthash: '0xbb' }));
  });
});

describe('offlineCacheUseCase.sweepOrphanedArchives', () => {
  it('removes on-disk archives whose product is not pinned, keeps pinned ones', async () => {
    const pinned: PersistedProduct = { ...product, baseName: 'keep.dot', pinned: true, createdAt: 1, updatedAt: 1 };
    vi.spyOn(productDb, 'getAll').mockReturnValue(okAsync([pinned]));
    window.App.listPersistedArchives = vi.fn(async () => [
      { domain: 'app.keep.dot', contenthash: '0xaa', sizeBytes: 1 },
      { domain: 'app.gone.dot', contenthash: '0xbb', sizeBytes: 1 },
    ]);

    await offlineCacheUseCase.sweepOrphanedArchives();

    expect(window.App.deleteArchive).toHaveBeenCalledWith('app.gone.dot');
    expect(window.App.deleteArchive).not.toHaveBeenCalledWith('app.keep.dot');
  });

  it('keeps a legacy bare-baseName archive of a pinned product', async () => {
    const pinned: PersistedProduct = { ...product, baseName: 'legacy.dot', pinned: true, createdAt: 1, updatedAt: 1 };
    vi.spyOn(productDb, 'getAll').mockReturnValue(okAsync([pinned]));
    // Legacy products persist their app archive under the bare base name.
    window.App.listPersistedArchives = vi.fn(async () => [{ domain: 'legacy.dot', contenthash: '0xaa', sizeBytes: 1 }]);

    await offlineCacheUseCase.sweepOrphanedArchives();

    expect(window.App.deleteArchive).not.toHaveBeenCalledWith('legacy.dot');
  });
});
