import { scale } from '@parity/truapi';
import { type RequiredHostCallbacks, encodeCoreStorageKey } from '@parity/truapi-host';
import { ok } from 'neverthrow';
import { distinctUntilChanged, map } from 'rxjs';

import { observableToAsyncIterable } from '@/shared/rxstate';
import { coreSlotService, coreStorageUseCase, productStorageUseCase } from '@/domains/product';

type ProductStorageCallbacks = Pick<RequiredHostCallbacks, 'productStorage'>;
type CoreStorageCallbacks = Pick<RequiredHostCallbacks, 'coreStorage'>;

/**
 * Product key/value storage. Keys arrive core-namespaced and may belong to another
 * product on a read the core granted, which is why the host looks up by key alone
 * and leaves ownership to the core.
 */
export function createProductStorageCallbacks(): ProductStorageCallbacks {
  return {
    productStorage: {
      read: key => productStorageUseCase.readEntry(key),
      write: (key, value) => productStorageUseCase.writeEntry(key, value),
      clear: key => productStorageUseCase.clearEntry(key),
      clearProduct: productId => productStorageUseCase.clearOwnerEntries(productId),
      // The wire carries hex, not bytes, so the conversion happens here and the
      // domain stream stays in `Uint8Array`. Comparing the converted string is also
      // what makes the "unchanged write emits nothing" rule a plain `===`.
      subscribeStorage: key =>
        observableToAsyncIterable(
          productStorageUseCase.watchEntry(key).pipe(
            map(value => (value === undefined ? undefined : scale.bytesToHex(value))),
            distinctUntilChanged(),
            map(value => ok({ value })),
          ),
        ),
    },
  };
}

/**
 * Host-private storage for the core's own state — the auth session blob, pairing
 * identity, permission authorizations, allowance keys. Host-global: one instance
 * serves every product, because the slots are the core's, not a product's.
 *
 * `encodeCoreStorageKey` turns the typed slot into the opaque bytes the repository
 * stores under, so two slots differing only in their payload stay distinct.
 */
export function createCoreStorageCallbacks(): CoreStorageCallbacks {
  return {
    coreStorage: {
      readCoreStorage: key => coreStorageUseCase.readSlot(encodeCoreStorageKey(key)),
      writeCoreStorage: (key, value) =>
        coreStorageUseCase.writeSlot(encodeCoreStorageKey(key), value, coreSlotService.describeSlot(key)),
      clearCoreStorage: key => coreStorageUseCase.clearSlot(encodeCoreStorageKey(key)),
    },
  };
}
