import { type CoreStorageKey, StoredPermissionRequest } from '@parity/truapi-host';

import { type CoreSlotDescriptor } from './types';

/**
 * Whether a permission slot's `scope` names a full product rather than a bare label.
 *
 * Mirrors the order the core's own `describe_core_storage_key` resolves a scope in
 * (`platform.rs`, tag 0.29.0): a scope that parses as a product id is a product, and
 * anything else is a bare label. A product id always carries a TLD or is a localhost
 * development id; a bare label carries neither.
 */
function isProductScope(scope: string): boolean {
  return scope.includes('.') || scope === 'localhost' || scope.startsWith('localhost:');
}

/**
 * The key's own fields, kept alongside the encoded key so the host can enumerate the
 * slots it holds for a product and sweep them when that product is removed.
 *
 * The owner is recorded the way the core assigns it: `productId` for a slot owned by
 * one product executable, `productLabel` for one shared by every executable of a
 * product. A `productId` field is detected **structurally**, not from a list of tags: the
 * core owns the `CoreStorageKey` union and adds variants, and a hand-listed set
 * silently stops indexing the day one arrives. The two variants keyed by something
 * else — a permission's `scope` and a manifest's `productLabel` — are named here
 * because their field carries no product id to detect.
 */
function describeSlot(key: CoreStorageKey): CoreSlotDescriptor {
  const descriptor: CoreSlotDescriptor = { slotTag: key.tag };

  if (key.value && 'productId' in key.value) {
    descriptor.productId = key.value.productId;
  }

  if (key.tag === 'ProductManifest') {
    descriptor.productLabel = key.value.productLabel;
  }

  // The only slot carrying a request. Encoded with the core's own codec, so nothing
  // here restates the request's shape.
  if (key.tag === 'PermissionAuthorization') {
    const { scope, request } = key.value;
    if (isProductScope(scope)) {
      descriptor.productId = scope;
    } else {
      descriptor.productLabel = scope;
    }
    descriptor.request = StoredPermissionRequest.enc(request);
  }

  return descriptor;
}

export const coreSlotService = { describeSlot };
