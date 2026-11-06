import { CoreStorageKey } from '@parity/truapi-host';
import { fromHex } from 'polkadot-api/utils';

import { coreStorageRepository } from '../core-storage/repository';
import { coreSlotService } from '../core-storage/service';
import { type CoreSlotDescriptor } from '../core-storage/types';
import { dotNsService } from '../dotns/service';

// The domain's public surface for the host-private slots the TrUAPI core owns.
// The core hands over a SCALE-encoded key and an opaque value; nothing here
// interprets either.
//
// Thin by design. `repository.ts` may not sit on the domain barrel
// (`local-rules/enforce-import-restrictions`), and the storage has no cache or
// identity to justify a resource, so a use case owning the read/write is the
// sanctioned way for host-side callback code to reach it. `productStorage.ts` is the
// same shape for a product's own entries.

async function readSlot(encodedKey: Uint8Array): Promise<Uint8Array | undefined> {
  return coreStorageRepository.readSlot(encodedKey);
}

async function writeSlot(encodedKey: Uint8Array, value: Uint8Array, descriptor?: CoreSlotDescriptor): Promise<void> {
  await coreStorageRepository.writeSlot(encodedKey, value, descriptor);
}

async function clearSlot(encodedKey: Uint8Array): Promise<void> {
  await coreStorageRepository.clearSlot(encodedKey);
}

/**
 * Give core-storage rows the key fields the schema indexes, so a slot whose columns are
 * incomplete becomes visible to enumeration reads and to the product sweep.
 *
 * Two generations need it: rows written before schema v9 carry no `slotTag`, and rows
 * written since carry one but no `productId` whenever their variant was not yet
 * indexed. For a permission slot the first case means the core still enforces a
 * decision the settings page cannot show, and so cannot revoke; for the second it means
 * the slot outlives the product it belongs to.
 *
 * Idempotent — a row already holding what the deriver produces is skipped, so this does
 * not rewrite the same rows on every launch. A row whose key will not decode keeps its
 * current shape: it is the core's data, and a key we cannot read is not one we should
 * rewrite or delete.
 *
 * Owned here rather than in the Dexie upgrade because deciding what a row should hold
 * needs the TrUAPI codec, which `@/shared` may not depend on — and the repository may
 * not reach the service that derives it.
 */
async function backfillDescriptors(): Promise<void> {
  const rows = await coreStorageRepository.descriptorCandidates();

  for (const row of rows) {
    let key;
    try {
      key = CoreStorageKey.dec(fromHex(row.key));
    } catch {
      continue;
    }

    const descriptor = coreSlotService.describeSlot(key);
    if (
      row.slotTag === descriptor.slotTag &&
      row.productId === descriptor.productId &&
      row.productLabel === descriptor.productLabel
    ) {
      continue;
    }

    await coreStorageRepository.updateDescriptor(row.key, descriptor);
  }
}

/**
 * Drop every core-owned slot a removed product owned.
 *
 * Matched by base name, not by exact id: a slot is keyed by whatever product id the
 * core was handed, which is the raw webview identifier, while a purge holds the
 * normalized name. Slots the core files per product rather than per executable carry
 * the bare label instead, and go with it.
 */
async function clearProductSlots({ productId, tld }: { productId: string; tld: string }): Promise<void> {
  const owners = await coreStorageRepository.productIdsWithSlots();
  const matching = owners.filter(owner => dotNsService.isSameBaseName(owner, productId, tld));

  await coreStorageRepository.clearProductSlots(matching.length > 0 ? matching : [productId], [dotNsService.labelOf(productId)]);
}

export const coreStorageUseCase = {
  clearProductSlots,
  readSlot,
  writeSlot,
  clearSlot,
  backfillDescriptors,
};
