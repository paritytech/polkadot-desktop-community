import 'fake-indexeddb/auto';

import { okAsync } from 'neverthrow';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { database } from '@/shared/database';
import { environmentUseCase } from '@/domains/application';
import { ipfsRawResource } from '@/domains/network';
import { executableCacheRepository } from '../product/executable-cache/repository';
import { archiveGateway } from '../product/manifest/gateway';
import { executableArchiveResource } from '../product/manifest/resource';
import { type PersistedProduct, productDb } from '../product/repository';
import { type Product } from '../product/types';

import { offlineCacheUseCase } from './offlineCache';
import { resolveProductUseCase } from './resolve';

const product: Product = {
  baseName: 'app.dot',
  displayName: 'App',
  description: '',
  icon: { cid: '', format: 'png' },
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test fixture executable
  executables: { app: { kind: 'app', identifier: 'app.app.dot', appVersion: [0, 0, 0], contenthash: '0xaa' } as never },
};

beforeEach(() => {
  // The prefetch path resolves the IPFS gateway URL before reaching
  // `archiveGateway.fetchExecutable`. Unmocked it throws (no Remote Config in
  // tests), and `prefetchArchives` is best-effort — every kind would land on
  // 'failed' through the catch, so the fetch spies below would never be hit.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the ipfs URL is read here
  vi.spyOn(environmentUseCase, 'getActive').mockResolvedValue({ ipfsGatewayUrl: 'https://ipfs.test' } as never);

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
    // `peekExecutableArchive` reads the archive resource's cache, so the case is
    // stated by warming that cache — every other test starts on the empty one the
    // global reset leaves behind, which is exactly the "nothing cached" case.
    const cached = {
      contenthash: '0xaa' as const,
      archive: { domain: 'app.app.dot', origin: 'polkadot://app.app.dot', files: { 'index.html': new Uint8Array([1, 2]) } },
    };
    executableArchiveResource.instead(() => cached);
    await firstValueFrom(executableArchiveResource.read$({ product, kind: 'app', ipfsGatewayUrl: 'https://ipfs.test' }));

    const fetchSpy = vi.spyOn(archiveGateway, 'fetchExecutable');

    await offlineCacheUseCase.prefetchArchives(product);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(window.App.persistArchive).toHaveBeenCalledTimes(1);
    const rows = await executableCacheRepository.getByBaseName('app.dot');
    expect(rows[0]).toEqual(expect.objectContaining({ status: 'ready', contenthash: '0xaa' }));
  });

  // A directory CID is read twice: as-is (just its index.html), then as a CAR. A
  // miss on the second read must fail the kind, not store a one-file archive.
  it('marks failed and persists nothing when the CAR read misses', async () => {
    const decodable: Product = {
      ...product,
      executables: {
        app: {
          ...product.executables.app!,
          contenthash: '0xe30101551220e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        },
      },
    };
    ipfsRawResource.instead(({ asCar }) =>
      Promise.resolve(asCar ? null : new TextEncoder().encode('<!doctype html><html></html>')),
    );

    await offlineCacheUseCase.prefetchArchives(decodable);

    expect(window.App.persistArchive).not.toHaveBeenCalled();
    const rows = await executableCacheRepository.getByBaseName('app.dot');
    expect(rows[0]).toEqual(expect.objectContaining({ status: 'failed' }));
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
  const pinnedRow = (baseName: string, identifier: string, contenthash: string): PersistedProduct => ({
    ...product,
    baseName,
    pinned: true,
    createdAt: 1,
    updatedAt: 1,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test fixture executable
    executables: { app: { kind: 'app', identifier, appVersion: [0, 0, 0], contenthash } as never },
  });

  it('re-persists the FROZEN version on a disk miss — never re-resolves chain', async () => {
    window.App.hasArchive = vi.fn(async () => false); // bytes missing → needs re-persist

    const p1 = pinnedRow('p1.dot', 'app.p1.dot', '0xfrozen');
    vi.spyOn(productDb, 'getAll').mockReturnValue(okAsync([p1]));
    const chainSpy = vi.spyOn(resolveProductUseCase, 'fetchProductFromChain');
    const upsertSpy = vi.spyOn(productDb, 'upsert');
    vi.spyOn(archiveGateway, 'fetchExecutable').mockResolvedValue({
      contenthash: '0xfrozen',
      archive: { domain: 'app.p1.dot', origin: 'polkadot://app.p1.dot', files: { 'index.html': new Uint8Array([1]) } },
    });

    await offlineCacheUseCase.reconcilePinnedArchives();

    // The pin is NOT advanced: no chain resolve, no row upsert.
    expect(chainSpy).not.toHaveBeenCalled();
    expect(upsertSpy).not.toHaveBeenCalled();
    // The frozen bytes are re-persisted.
    expect(window.App.persistArchive).toHaveBeenCalledTimes(1);
    const rows = await executableCacheRepository.getByBaseName('p1.dot');
    expect(rows[0]).toEqual(expect.objectContaining({ status: 'ready', contenthash: '0xfrozen' }));
  });

  it('a per-product failure does not abort re-persist of the remaining pinned products', async () => {
    const p1 = pinnedRow('p1.dot', 'app.p1.dot', '0xaa');
    const p2 = pinnedRow('p2.dot', 'app.p2.dot', '0xbb');
    vi.spyOn(productDb, 'getAll').mockReturnValue(okAsync([p1, p2]));

    // p1's presence probe rejects (IPC failure); p2's reports the bytes missing so it
    // needs a re-persist. p1's rejection must not abort the loop before p2 is reached.
    window.App.hasArchive = vi.fn(async (identifier: string) => {
      if (identifier === 'app.p1.dot') throw new Error('ipc down');
      return false;
    });
    vi.spyOn(archiveGateway, 'fetchExecutable').mockResolvedValue({
      contenthash: '0xbb',
      archive: { domain: 'app.p2.dot', origin: 'polkadot://app.p2.dot', files: { 'index.html': new Uint8Array([1]) } },
    });

    await offlineCacheUseCase.reconcilePinnedArchives();

    // p1 threw, but p2 was still re-persisted from its frozen bytes.
    expect(window.App.persistArchive).toHaveBeenCalledTimes(1);
    const rows = await executableCacheRepository.getByBaseName('p2.dot');
    expect(rows[0]).toEqual(expect.objectContaining({ status: 'ready', contenthash: '0xbb' }));
  });

  it('marks the kind failed (not advanced) when the frozen bytes are unfetchable', async () => {
    window.App.hasArchive = vi.fn(async () => false);

    const p1 = pinnedRow('p1.dot', 'app.p1.dot', '0xfrozen');
    vi.spyOn(productDb, 'getAll').mockReturnValue(okAsync([p1]));
    const upsertSpy = vi.spyOn(productDb, 'upsert');
    vi.spyOn(archiveGateway, 'fetchExecutable').mockResolvedValue(null); // gone from IPFS

    await offlineCacheUseCase.reconcilePinnedArchives();

    expect(upsertSpy).not.toHaveBeenCalled();
    const rows = await executableCacheRepository.getByBaseName('p1.dot');
    expect(rows[0]).toEqual(expect.objectContaining({ status: 'failed', contenthash: '0xfrozen' }));
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
