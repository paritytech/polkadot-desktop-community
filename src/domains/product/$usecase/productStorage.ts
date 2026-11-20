import { type Observable } from 'rxjs';

import { productLocalStorageRepository } from '../local-storage/repository';
import { productStorageKeyService } from '../local-storage/service';

// The domain's public surface for product key/value storage. The core hands over an
// opaque, already-namespaced key and a blob; nothing here interprets either.
//
// Thin by design, and for the same reason as `coreStorage.ts`: `repository.ts` may
// not sit on the domain barrel (`local-rules/enforce-import-restrictions`), and the
// storage has no cache or identity to justify a resource, so a use case owning the
// read/write is how host-side callback code reaches it.

function readEntry(key: string): Promise<Uint8Array | undefined> {
  return productLocalStorageRepository.readEntry(key);
}

function writeEntry(key: string, value: Uint8Array): Promise<void> {
  return productLocalStorageRepository.writeEntry(key, value);
}

function clearEntry(key: string): Promise<void> {
  return productLocalStorageRepository.clearEntry(key);
}

function watchEntry(key: string): Observable<Uint8Array | undefined> {
  return productLocalStorageRepository.watchEntry(key);
}

/** Remove every entry the core filed under exactly `productId` — the core's `clearProduct`. */
function clearOwnerEntries(productId: string): Promise<void> {
  return productLocalStorageRepository.clearByPrefix(productStorageKeyService.ownerPrefix(productId));
}

export const productStorageUseCase = {
  readEntry,
  writeEntry,
  clearEntry,
  clearOwnerEntries,
  watchEntry,
};
