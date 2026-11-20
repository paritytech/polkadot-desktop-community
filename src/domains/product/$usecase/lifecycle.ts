import { createSideEffect } from '@/shared/di';
import { isElectron } from '@/shared/env';
import { coreStorageRepository } from '../core-storage/repository';
import { dotNsService } from '../dotns/service';
import { productLocalStorageRepository } from '../local-storage/repository';
import { productStorageKeyService } from '../local-storage/service';
import { EXECUTABLE_KINDS, invalidateExecutableArchive, productDb } from '../product';
import { declinedUpdatesRepository } from '../product/declined-updates/repository';

import { dotNsUseCase } from './dotns';
import { offlineCacheUseCase } from './offlineCache';

const onProductForgottenSideEffect = createSideEffect<{ productId: string }>({
  name: 'onProductForgotten',
});

/**
 * Every product id the core holds state under for `productId`: its grants, keys and
 * storage are filed under whatever id it was handed, which is the raw webview
 * identifier, while the host holds the normalized base name. Matched by base name
 * over the owners of core slots and product-storage entries; `productId` itself is
 * always included, so a product with nothing stored still gets one clear.
 */
async function listCoreProductIds(productId: string): Promise<string[]> {
  const [tld, slotOwners, storageKeys] = await Promise.all([
    dotNsUseCase.getActiveTld(),
    coreStorageRepository.productIdsWithSlots(),
    productLocalStorageRepository.listKeys(),
  ]);
  const storageOwners = storageKeys.flatMap(key => productStorageKeyService.ownerOf(key) ?? []);
  const owners = [...slotOwners, ...storageOwners].filter(owner => dotNsService.isSameBaseName(owner, productId, tld));

  return [...new Set([productId, ...owners])];
}

// Product-internal teardown: drop the row and cached archives, then clear the
// sandbox. The product's core state (grants, keys, storage) is the core's to clear,
// and dashboard detachment is cross-domain: the product-management aggregate owns
// both and calls this after them.
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

  const [deleteResult] = await Promise.all([
    productDb.delete(productId),
    offlineCacheUseCase.evictArchives(productId),
    // Best-effort: a failing declined-updates wipe must not abort the rest of
    // the reset, otherwise declined rows would leak past a forget.
    declinedUpdatesRepository.deleteByBaseName(productId).catch(error => {
      console.warn('deleteByBaseName (declinedUpdates) failed for', productId, error);
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
  if (isElectron()) {
    await window.App.clearProductData(productId);
  }
}

export const lifecycleUseCase = {
  onProductForgottenSideEffect,
  listCoreProductIds,
  purgeProduct,
  refreshProduct,
  clearProductCache,
};
