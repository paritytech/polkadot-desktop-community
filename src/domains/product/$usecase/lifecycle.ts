import { createSideEffect } from '@/shared/di';
import { isElectron } from '@/shared/env';
import { deleteAliasPermissionsByRequester } from '../alias-permissions/resource';
import { productLocalStorageRepository } from '../local-storage/repository';
import { deleteProductPermissions } from '../permissions/resource';
import { EXECUTABLE_KINDS, invalidateExecutableArchive, productDb } from '../product';

import { offlineCacheUseCase } from './offlineCache';

const onProductForgottenSideEffect = createSideEffect<{ productId: string }>({
  name: 'onProductForgotten',
});

// Product-internal teardown: drop the row, its permissions, cached archives and
// local storage, then clear the sandbox. Dashboard detachment is a cross-domain
// concern owned by the product-management aggregate, which calls this after it
// has removed the product from the dashboard.
async function purgeProduct(productId: string): Promise<boolean> {
  // Read the row's executables BEFORE deleting so we can pass each executable's
  // contenthash to invalidateExecutableArchive for precise cache eviction.
  const existingResult = await productDb.getByBaseName(productId);
  const existing = existingResult.isOk() ? existingResult.value : null;

  // Drop per-executable archive caches before the Dexie delete so the
  // productsResource liveQuery and the archive cache emit the post-forget
  // state in the same tick.
  for (const kind of EXECUTABLE_KINDS) {
    const executable = existing?.executables[kind];
    if (executable?.contenthash) {
      invalidateExecutableArchive(productId, kind, executable.contenthash);
    } else {
      invalidateExecutableArchive(productId, kind);
    }
  }

  const [, , deleteResult] = await Promise.all([
    deleteProductPermissions(productId),
    deleteAliasPermissionsByRequester(productId),
    productDb.delete(productId),
    offlineCacheUseCase.evictArchives(productId),
    // Best-effort: a failing local-storage wipe must not abort the rest of the
    // reset (sandbox clear below, side-effect fan-out). Without the catch,
    // Promise.all would reject and skip them.
    productLocalStorageRepository.clearAllEntries(productId).catch(error => {
      console.warn('clearAllEntries failed for', productId, error);
    }),
  ]);

  if (isElectron()) {
    void window.App.clearProductSandboxData(productId).catch(error => {
      console.warn('clearProductSandboxData failed for', productId, error);
    });
  }

  const success = deleteResult.isOk();
  if (success) {
    onProductForgottenSideEffect.apply({ productId });
  }

  return success;
}

function refreshProduct(domain: string) {
  for (const kind of EXECUTABLE_KINDS) {
    invalidateExecutableArchive(domain, kind);
  }
}

async function clearProductCache(productId: string): Promise<void> {
  await Promise.all([
    isElectron() ? window.App.clearProductData(productId) : Promise.resolve(),
    productLocalStorageRepository.clearAllEntries(productId),
  ]);
}

export const lifecycleUseCase = {
  onProductForgottenSideEffect,
  purgeProduct,
  refreshProduct,
  clearProductCache,
};
