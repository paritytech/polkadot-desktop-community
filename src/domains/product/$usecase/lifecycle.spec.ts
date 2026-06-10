import { ResultAsync } from 'neverthrow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../product', () => ({
  EXECUTABLE_KINDS: ['app', 'widget', 'worker'],
  invalidateExecutableArchive: vi.fn(),
  productDb: {
    delete: vi.fn(),
    getByBaseName: vi.fn(),
  },
}));

vi.mock('../permissions/resource', () => ({
  deleteProductPermissions: vi.fn(),
}));

vi.mock('../alias-permissions/resource', () => ({
  deleteAliasPermissionsByRequester: vi.fn(),
}));

vi.mock('../local-storage/repository', () => ({
  productLocalStorageRepository: {
    clearAllEntries: vi.fn(),
  },
}));

vi.mock('@/shared/env', () => ({
  isElectron: vi.fn(() => true),
}));

vi.mock('./offlineCache', () => ({
  offlineCacheUseCase: {
    prefetchArchives: vi.fn(),
    evictArchives: vi.fn(),
    reconcilePinnedArchives: vi.fn(),
  },
}));

import { isElectron } from '@/shared/env';
import { deleteAliasPermissionsByRequester } from '../alias-permissions/resource';
import { productLocalStorageRepository } from '../local-storage/repository';
import { deleteProductPermissions } from '../permissions/resource';
import { invalidateExecutableArchive, productDb } from '../product';

import { lifecycleUseCase } from './lifecycle';

const onProductForgottenSpy = vi.spyOn(lifecycleUseCase.onProductForgottenSideEffect, 'apply');

const okResult = (): ResultAsync<void, Error> => ResultAsync.fromSafePromise(Promise.resolve());
const errResult = (): ResultAsync<void, Error> =>
  ResultAsync.fromPromise(Promise.reject(new Error('boom')), e => (e instanceof Error ? e : new Error(String(e))));

const clearProductSandboxData = vi.fn();
const clearProductData = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(deleteProductPermissions).mockResolvedValue(undefined);
  vi.mocked(deleteAliasPermissionsByRequester).mockResolvedValue(undefined);
  vi.mocked(productLocalStorageRepository.clearAllEntries).mockResolvedValue(undefined);
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

  it('clears the product local storage entries on every platform', async () => {
    vi.mocked(productDb.delete).mockReturnValue(okResult());

    await lifecycleUseCase.purgeProduct('app.dot');

    expect(productLocalStorageRepository.clearAllEntries).toHaveBeenCalledWith('app.dot');
  });

  it('clears the product local storage entries even in web mode', async () => {
    vi.mocked(productDb.delete).mockReturnValue(okResult());
    vi.mocked(isElectron).mockReturnValue(false);

    await lifecycleUseCase.purgeProduct('app.dot');

    expect(productLocalStorageRepository.clearAllEntries).toHaveBeenCalledWith('app.dot');
  });

  it('does not call the sandbox IPC in web mode', async () => {
    vi.mocked(productDb.delete).mockReturnValue(okResult());
    vi.mocked(isElectron).mockReturnValue(false);

    await lifecycleUseCase.purgeProduct('app.dot');

    expect(clearProductSandboxData).not.toHaveBeenCalled();
  });

  it('deletes alias-permission rows where the product is the requester', async () => {
    vi.mocked(productDb.delete).mockReturnValue(okResult());

    await lifecycleUseCase.purgeProduct('app.dot');

    expect(deleteAliasPermissionsByRequester).toHaveBeenCalledWith('app.dot');
  });

  it('invalidates the executable archive cache for every kind', async () => {
    vi.mocked(productDb.delete).mockReturnValue(okResult());
    await lifecycleUseCase.purgeProduct('app.dot');
    expect(vi.mocked(invalidateExecutableArchive)).toHaveBeenCalledWith('app.dot', 'app');
    expect(vi.mocked(invalidateExecutableArchive)).toHaveBeenCalledWith('app.dot', 'widget');
    expect(vi.mocked(invalidateExecutableArchive)).toHaveBeenCalledWith('app.dot', 'worker');
  });

  it('runs permissions deletion and DB delete in parallel (Promise.all)', async () => {
    let permissionsResolve: (() => void) | null = null;
    vi.mocked(deleteProductPermissions).mockImplementation(
      () =>
        new Promise<void>(resolve => {
          permissionsResolve = resolve;
        }),
    );
    vi.mocked(productDb.delete).mockReturnValue(okResult());

    const pending = lifecycleUseCase.purgeProduct('app.dot');
    // DB delete already resolved; the use case should still be pending on permissions.
    // getByBaseName now runs before Promise.all (reading the existing row before
    // invalidating caches), adding several async hops before deleteProductPermissions
    // is called. Wait enough microtasks for the full chain to settle.
    for (let i = 0; i < 10; i++) await Promise.resolve();
    permissionsResolve!();
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

  it('still clears the sandbox partition when clearAllEntries rejects (best-effort)', async () => {
    vi.mocked(productDb.delete).mockReturnValue(okResult());
    vi.mocked(productLocalStorageRepository.clearAllEntries).mockRejectedValue(new Error('dexie-locked'));
    vi.mocked(isElectron).mockReturnValue(true);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(lifecycleUseCase.purgeProduct('app.dot')).resolves.toBe(true);
    expect(clearProductSandboxData).toHaveBeenCalledWith('app.dot');
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
  it('clears sandbox session data and product storage in Electron mode', async () => {
    vi.mocked(isElectron).mockReturnValue(true);

    await lifecycleUseCase.clearProductCache('app.dot');

    expect(clearProductData).toHaveBeenCalledTimes(1);
    expect(clearProductData).toHaveBeenCalledWith('app.dot');
    expect(productLocalStorageRepository.clearAllEntries).toHaveBeenCalledTimes(1);
    expect(productLocalStorageRepository.clearAllEntries).toHaveBeenCalledWith('app.dot');
  });

  it('skips sandbox IPC in web mode but still clears product storage', async () => {
    vi.mocked(isElectron).mockReturnValue(false);

    await lifecycleUseCase.clearProductCache('app.dot');

    expect(clearProductData).not.toHaveBeenCalled();
    expect(productLocalStorageRepository.clearAllEntries).toHaveBeenCalledWith('app.dot');
  });
});
