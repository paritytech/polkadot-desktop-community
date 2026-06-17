import { produce } from 'immer';
import { type Observable, from, map } from 'rxjs';
import * as v from 'valibot';

import { createStreamResource } from '@/shared/resource';
import { dotNsService } from '../dotns/service';

import { type PermissionModality } from './constants';
import { productPermissionsDatabase } from './repository';
import { productPermissionsSchema } from './schemas';
import { permissionsService } from './service';
import { type DevicePermission, type DevicePermissionType, type ProductPermissions, type RemotePermission } from './types';

// Parse one persisted row, dropping it (→ null) if it fails validation rather than
// erroring the whole stream. A single corrupt or forward-incompatible row must not
// blank out every product's permissions for the rest of the subscription.
function parseRow(row: unknown): ProductPermissions | null {
  const result = v.safeParse(productPermissionsSchema, row);
  if (result.success) return result.output;

  console.warn('[permissions] dropping unparseable productPermissions row', result.issues);

  return null;
}

export const allProductPermissionsResource = createStreamResource<object>({
  key: () => 'all',
})
  .subscribe<ProductPermissions[]>(() => {
    return productPermissionsDatabase
      .stream$(table => table.toArray())
      .pipe(map(rows => rows.map(parseRow).filter((permissions): permissions is ProductPermissions => permissions !== null)));
  })
  .cache<ProductPermissions[]>({
    initial: [],
    map(_, permissions) {
      return permissions;
    },
  })
  .build();

export const productPermissionsResource = createStreamResource<{ productId: string }>({
  key: ({ productId }) => productId,
})
  .subscribe<ProductPermissions | null>(({ productId }) => {
    return productPermissionsDatabase.stream$(table => table.get(productId)).pipe(map(row => (row ? parseRow(row) : null)));
  })
  .cache<Record<string, ProductPermissions | null>>({
    initial: {},
    map(store, permissions, { productId }) {
      return {
        ...store,
        [productId]: permissions,
      };
    },
  })
  .build();

// Read the product's permission record (defaulting to an empty one), apply an
// immer recipe, and persist it — the shared read-modify-write lifecycle behind
// every permission mutation. Callers supply only the recipe so the default-record
// shape and persistence path stay defined in exactly one place. The whole cycle
// runs in one `rw` transaction so concurrent mutations for the same product
// (e.g. a device-permission grant and a remote batch resolving together) serialize
// instead of reading the same snapshot and clobbering each other on write.
function mutateProductPermissions(productId: string, recipe: (draft: ProductPermissions) => void): Observable<void> {
  return from(
    productPermissionsDatabase.transact(async table => {
      const row = await table.get(productId);
      const existing = row ? parseRow(row) : null;
      const permissions = existing ?? { productId, devicePermissions: [], remotePermissions: [] };
      await table.put(produce(permissions, recipe));
    }),
  );
}

export function setDevicePermission({
  productId,
  permission,
}: {
  productId: string;
  permission: DevicePermission;
}): Observable<void> {
  return mutateProductPermissions(productId, draft => permissionsService.upsertDevicePermission(draft, permission));
}

export function setRemotePermission({
  productId,
  permission,
}: {
  productId: string;
  permission: RemotePermission;
}): Observable<void> {
  return mutateProductPermissions(productId, draft => permissionsService.upsertRemotePermission(draft, permission));
}

export function setRemotePermissionsBatch({
  productId,
  permissions: incoming,
}: {
  productId: string;
  permissions: RemotePermission[];
}): Observable<void> {
  return mutateProductPermissions(productId, draft => {
    for (const permission of incoming) {
      permissionsService.upsertRemotePermission(draft, permission);
    }
  });
}

export function resetPermissionToDefault({
  productId,
  permissionId,
}: {
  productId: string;
  permissionId: string;
}): Observable<void> {
  return mutateProductPermissions(productId, draft => permissionsService.removePermissionEntries(draft, permissionId));
}

// Rows are keyed by the raw webview identifier, which may differ from the
// normalized base name callers (e.g. the purge flow) hold — match through
// `isSameBaseName`, not the primary key.
export async function deleteProductPermissions(productId: string): Promise<void> {
  await productPermissionsDatabase.table.filter(row => dotNsService.isSameBaseName(row.productId, productId)).delete();
}

// Session-scoped device-permission grants. "Allow once" must open the native
// getUserMedia gate (bootstrap.onDevicePermissionRequest) for the current product
// session WITHOUT persisting a durable 'granted'. This in-memory store is that
// channel — never persisted, consulted only by the native device gate, and cleared
// by the widget when the product binding unmounts or remounts (close / reload).
// Mirrors the in-memory pattern of broker.ts (ephemeral permission coordination).
const transientDeviceGrants = new Set<string>();

type TransientDeviceGrantParams = {
  productId: string;
  permission: DevicePermissionType;
  modality: PermissionModality;
};

function transientDeviceGrantKey({ productId, permission, modality }: TransientDeviceGrantParams): string {
  return `${productId}\0${permission}\0${modality}`;
}

export function grantTransientDevicePermission(params: TransientDeviceGrantParams): void {
  transientDeviceGrants.add(transientDeviceGrantKey(params));
}

export function getTransientDevicePermissionGranted(params: TransientDeviceGrantParams): boolean {
  return transientDeviceGrants.has(transientDeviceGrantKey(params));
}

export function clearTransientDevicePermissionGrants({
  productId,
  modality,
}: {
  productId: string;
  modality: PermissionModality;
}): void {
  const prefix = `${productId}\0`;
  const suffix = `\0${modality}`;
  for (const key of transientDeviceGrants) {
    if (key.startsWith(prefix) && key.endsWith(suffix)) {
      transientDeviceGrants.delete(key);
    }
  }
}

// Test-only: drop all transient grants. Mirrors broker.ts's _resetRemotePermissionBroker.
export function _resetTransientDevicePermissionGrants(): void {
  transientDeviceGrants.clear();
}
