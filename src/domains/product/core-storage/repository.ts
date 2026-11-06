import { toHex } from 'polkadot-api/utils';
import { type Observable, map } from 'rxjs';

import { database, streamTable } from '@/shared/database';

import { type CoreSlotDescriptor } from './types';

// Host-private persistence for slots the TrUAPI core owns: the opaque auth session
// blob, the pairing device identity, per-product permission authorizations, allowance
// keys. The core hands us a SCALE-encoded key and an opaque value; neither is
// interpreted here.
//
// The key's own decoded fields ride along as indexed columns. That is not a second
// source of truth: the columns hold keys the core handed us, never statuses, and every
// status is read back from the core.
//
// Imperative for the point reads (no cache, no identity of their own); the enumeration
// reads are liveQuery streams because a permission decision changing IS a write to this
// table, so the table is its own change signal.
const PERMISSION_SLOT_TAG = 'PermissionAuthorization';

function slotKey(encodedKey: Uint8Array): string {
  return toHex(encodedKey);
}

async function readSlot(encodedKey: Uint8Array): Promise<Uint8Array | undefined> {
  const row = await database.coreStorage.get(slotKey(encodedKey));

  return row?.value;
}

async function writeSlot(encodedKey: Uint8Array, value: Uint8Array, descriptor?: CoreSlotDescriptor): Promise<void> {
  await database.coreStorage.put({ key: slotKey(encodedKey), value, ...descriptor });
}

async function clearSlot(encodedKey: Uint8Array): Promise<void> {
  await database.coreStorage.delete(slotKey(encodedKey));
}

/** The decoded request of every permission slot held for `productId`. */
function permissionSlots$(productId: string): Observable<unknown[]> {
  return streamTable(database.coreStorage, table => table.where({ slotTag: PERMISSION_SLOT_TAG, productId }).toArray()).pipe(
    map(rows => rows.flatMap(row => (row.request === undefined ? [] : [row.request]))),
  );
}

/** Every product id holding at least one permission slot, sorted. */
function productIdsWithPermissionSlots$(): Observable<string[]> {
  return streamTable(database.coreStorage, table => table.where('slotTag').equals(PERMISSION_SLOT_TAG).toArray()).pipe(
    map(rows => {
      const ids = new Set<string>();
      for (const row of rows) {
        if (row.productId) ids.add(row.productId);
      }

      return [...ids].sort();
    }),
  );
}

/**
 * Rows that MIGHT still be missing an indexed key field: no `slotTag` at all (written
 * before schema v9), or a `slotTag` with neither a `productId` nor a `productLabel`. The
 * second case is not
 * hypothetical — a slot variant the descriptor did not yet index wrote exactly that
 * shape, and such a row is invisible to a `slotTag`-only filter.
 *
 * Deliberately over-selects. Most rows with no owner are slots that correctly
 * have none, and telling those apart from a row still missing one needs the key
 * decoded — which needs the core's codec, so it belongs to the use case. This returns
 * candidates; the use case decides, and skips the ones already correct. The table holds
 * one row per core-owned slot and this runs once at bootstrap, so the extra decodes are
 * cheaper than carrying a descriptor version to avoid them.
 */
async function descriptorCandidates(): Promise<{ key: string; slotTag?: string; productId?: string; productLabel?: string }[]> {
  return database.coreStorage
    .filter(row => row.slotTag === undefined || (row.productId === undefined && row.productLabel === undefined))
    .toArray();
}

/** Write the decoded key fields onto one row, leaving its value untouched. */
async function updateDescriptor(key: string, descriptor: CoreSlotDescriptor): Promise<void> {
  await database.coreStorage.update(key, descriptor);
}

/**
 * Drop every product-indexed slot belonging to `productIds`, and every label-indexed slot
 * belonging to `productLabels`.
 *
 * Clearing these is the host's job, per the core's `CoreStorage` contract: the core
 * drops what it is holding when a session ends, but a product it never opened this run
 * has no entry to drop, so those slots would outlive the disconnect and accumulate for
 * the life of the install. Which variants are product-indexed is not restated here —
 * `coreSlotService.describeSlot` decides it, and the `productId` / `productLabel` indexes
 * it populates are what make this a sweep rather than a scan.
 */
async function clearProductSlots(productIds: string[], productLabels: string[]): Promise<void> {
  if (productIds.length > 0) await database.coreStorage.where('productId').anyOf(productIds).delete();
  if (productLabels.length > 0) await database.coreStorage.where('productLabel').anyOf(productLabels).delete();
}

/**
 * Every product id owning at least one slot of ANY product-indexed kind.
 *
 * Deliberately not filtered by tag: a product may hold an `AutoSigningKey` or a
 * `ProductSubtree` without ever having answered a permission prompt, and the removal
 * sweep has to find those too.
 */
async function productIdsWithSlots(): Promise<string[]> {
  const keys = await database.coreStorage.orderBy('productId').uniqueKeys();

  return keys.flatMap(key => (typeof key === 'string' ? [key] : []));
}

export const coreStorageRepository = {
  readSlot,
  writeSlot,
  clearSlot,
  permissionSlots$,
  productIdsWithPermissionSlots$,
  descriptorCandidates,
  updateDescriptor,
  clearProductSlots,
  productIdsWithSlots,
};
