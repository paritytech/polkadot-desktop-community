import { ResultAsync } from 'neverthrow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock(import('@/shared/env'), async importOriginal => ({
  ...(await importOriginal()),
  isElectron: vi.fn(() => true),
}));

import { isElectron } from '@/shared/env';
import { type HexString } from '@/shared/types';
import { coreStorageRepository } from '../core-storage/repository';
import { productLocalStorageRepository } from '../local-storage/repository';
import { productStorageKeyService } from '../local-storage/service';
import { declinedUpdatesRepository } from '../product/declined-updates/repository';
import { type ExecutableKind } from '../product/manifest/constants';
import { executableArchiveResource } from '../product/manifest/resource';
import { productDb } from '../product/repository';

import { lifecycleUseCase } from './lifecycle';
import { offlineCacheUseCase } from './offlineCache';

// Every collaborator is a plain object, spied in place: the repositories so nothing
// reaches Dexie, the sibling use cases so no core call or archive eviction runs.
vi.spyOn(productDb, 'delete');
vi.spyOn(productDb, 'getByBaseName');
vi.spyOn(coreStorageRepository, 'productIdsWithSlots');
vi.spyOn(productLocalStorageRepository, 'listKeys');
vi.spyOn(declinedUpdatesRepository, 'deleteByBaseName');
vi.spyOn(offlineCacheUseCase, 'evictArchives');

const onProductForgottenSpy = vi.spyOn(lifecycleUseCase.onProductForgottenSideEffect, 'apply');

const okResult = (): ResultAsync<void, Error> => ResultAsync.fromSafePromise(Promise.resolve());
const errResult = (): ResultAsync<void, Error> =>
  ResultAsync.fromPromise(Promise.reject(new Error('boom')), e => (e instanceof Error ? e : new Error(String(e))));

const clearProductSandboxData = vi.fn();
const clearProductData = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(offlineCacheUseCase.evictArchives).mockResolvedValue();
  vi.mocked(coreStorageRepository.productIdsWithSlots).mockResolvedValue([]);
  vi.mocked(productLocalStorageRepository.listKeys).mockResolvedValue([]);
  vi.mocked(declinedUpdatesRepository.deleteByBaseName).mockResolvedValue(undefined);
  vi.mocked(isElectron).mockReturnValue(true);
  vi.mocked(productDb.getByBaseName).mockReturnValue(ResultAsync.fromSafePromise(Promise.resolve(null)));
  clearProductSandboxData.mockResolvedValue(undefined);
  clearProductData.mockResolvedValue({ success: true });
  onProductForgottenSpy.mockClear();
  onProductForgottenSpy.mockResolvedValue([]);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
  (globalThis as any).window = { App: { clearProductSandboxData, clearProductData } };
});

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
  delete (globalThis as any).window;
});

describe('purgeProduct', () => {
  it('still clears the sandbox partition when the DB delete fails (best-effort reset)', async () => {
    vi.mocked(productDb.delete).mockReturnValue(errResult());
    vi.mocked(isElectron).mockReturnValue(true);

    const result = await lifecycleUseCase.purgeProduct('app.dot');

    expect(result).toBe(false);
    expect(clearProductSandboxData).toHaveBeenCalledTimes(1);
    expect(clearProductSandboxData).toHaveBeenCalledWith('app.dot');
  });

  it('calls window.App.clearProductSandboxData in Electron mode', async () => {
    vi.mocked(productDb.delete).mockReturnValue(okResult());
    vi.mocked(isElectron).mockReturnValue(true);

    await lifecycleUseCase.purgeProduct('app.dot');

    expect(clearProductSandboxData).toHaveBeenCalledTimes(1);
    expect(clearProductSandboxData).toHaveBeenCalledWith('app.dot');
  });

  it('does not call the sandbox IPC in web mode', async () => {
    vi.mocked(productDb.delete).mockReturnValue(okResult());
    vi.mocked(isElectron).mockReturnValue(false);

    await lifecycleUseCase.purgeProduct('app.dot');

    expect(clearProductSandboxData).not.toHaveBeenCalled();
  });

  it('deletes declined-update rows for the product', async () => {
    vi.mocked(productDb.delete).mockReturnValue(okResult());

    await lifecycleUseCase.purgeProduct('app.dot');

    expect(declinedUpdatesRepository.deleteByBaseName).toHaveBeenCalledWith('app.dot');
  });

  it('still clears the sandbox partition when the declined-updates wipe rejects (best-effort)', async () => {
    vi.mocked(productDb.delete).mockReturnValue(okResult());
    vi.mocked(declinedUpdatesRepository.deleteByBaseName).mockRejectedValue(new Error('dexie-locked'));
    vi.mocked(isElectron).mockReturnValue(true);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(lifecycleUseCase.purgeProduct('app.dot')).resolves.toBe(true);
    expect(clearProductSandboxData).toHaveBeenCalledWith('app.dot');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('invalidates the executable archive cache for every kind', async () => {
    const executable = (kind: ExecutableKind, contenthash: HexString) => ({
      kind,
      identifier: `${kind}.app.dot`,
      contenthash,
      appVersion: [1, 0, 0],
    });
    vi.mocked(productDb.getByBaseName).mockReturnValue(
      ResultAsync.fromSafePromise(
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test fixture row, only executables are read
        Promise.resolve({
          executables: {
            app: executable('app', '0xaa'),
            widget: executable('widget', '0xbb'),
            worker: executable('worker', '0xcc'),
          },
        } as never),
      ),
    );
    const invalidate = vi.spyOn(executableArchiveResource, 'invalidate');
    vi.mocked(productDb.delete).mockReturnValue(okResult());

    await lifecycleUseCase.purgeProduct('app.dot');

    // One eviction per kind, each keyed by that kind's own frozen contenthash.
    for (const [kind, contenthash] of [
      ['app', '0xaa'],
      ['widget', '0xbb'],
      ['worker', '0xcc'],
    ] as const) {
      expect(invalidate).toHaveBeenCalledWith(
        expect.objectContaining({ kind, product: expect.objectContaining({ baseName: 'app.dot' }) }),
      );
      expect(invalidate.mock.calls.some(([params]) => params?.product?.executables[kind]?.contenthash === contenthash)).toBe(
        true,
      );
    }
  });

  it('runs archive eviction and DB delete in parallel (Promise.all)', async () => {
    let evictResolve: (() => void) | null = null;
    vi.mocked(offlineCacheUseCase.evictArchives).mockImplementation(
      () =>
        new Promise<void>(resolve => {
          evictResolve = resolve;
        }),
    );
    vi.mocked(productDb.delete).mockReturnValue(okResult());

    const pending = lifecycleUseCase.purgeProduct('app.dot');
    // DB delete already resolved; the use case should still be pending on eviction.
    await vi.waitFor(() => expect(evictResolve).not.toBeNull());
    evictResolve!();
    await expect(pending).resolves.toBe(true);
  });

  it('swallows clearProductSandboxData rejection without rejecting the use case', async () => {
    vi.mocked(productDb.delete).mockReturnValue(okResult());
    vi.mocked(isElectron).mockReturnValue(true);
    clearProductSandboxData.mockRejectedValue(new Error('ipc-failed'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(lifecycleUseCase.purgeProduct('app.dot')).resolves.toBe(true);
    // The warning fires asynchronously after the .catch.
    await new Promise(r => setTimeout(r, 0));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not await clearProductSandboxData (fire-and-forget)', async () => {
    vi.mocked(productDb.delete).mockReturnValue(okResult());
    vi.mocked(isElectron).mockReturnValue(true);
    clearProductSandboxData.mockReturnValue(new Promise(() => {})); // never resolves
    await expect(lifecycleUseCase.purgeProduct('app.dot')).resolves.toBe(true);
  });

  it('fires onProductForgottenSideEffect only on successful DB delete', async () => {
    vi.mocked(productDb.delete).mockReturnValue(okResult());
    await lifecycleUseCase.purgeProduct('app.dot');
    expect(onProductForgottenSpy).toHaveBeenCalledWith({ productId: 'app.dot' });

    onProductForgottenSpy.mockClear();
    vi.mocked(productDb.delete).mockReturnValue(errResult());
    await lifecycleUseCase.purgeProduct('app.dot');
    expect(onProductForgottenSpy).not.toHaveBeenCalled();
  });
});

describe('clearProductCache', () => {
  it('clears sandbox session data in Electron mode', async () => {
    vi.mocked(isElectron).mockReturnValue(true);

    await lifecycleUseCase.clearProductCache('app.dot');

    expect(clearProductData).toHaveBeenCalledTimes(1);
    expect(clearProductData).toHaveBeenCalledWith('app.dot');
  });

  it('skips sandbox IPC in web mode', async () => {
    vi.mocked(isElectron).mockReturnValue(false);

    await lifecycleUseCase.clearProductCache('app.dot');

    expect(clearProductData).not.toHaveBeenCalled();
  });
});

describe('listCoreProductIds', () => {
  it('lists every owner of core slots and storage entries matching the base name', async () => {
    vi.mocked(coreStorageRepository.productIdsWithSlots).mockResolvedValue(['App.dot', 'other.dot']);
    vi.mocked(productLocalStorageRepository.listKeys).mockResolvedValue([
      `${productStorageKeyService.ownerPrefix('app')}k`,
      `${productStorageKeyService.ownerPrefix('other.dot')}k`,
      'plain',
    ]);

    const ids = await lifecycleUseCase.listCoreProductIds('app.dot');

    expect([...ids].sort()).toEqual(['App.dot', 'app', 'app.dot']);
  });

  it('always includes the product id itself', async () => {
    await expect(lifecycleUseCase.listCoreProductIds('app.dot')).resolves.toEqual(['app.dot']);
  });
});
