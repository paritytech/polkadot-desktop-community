import Dexie, { type Table, type Transaction } from 'dexie';

import {
  type AliasPermissionRow,
  type DashboardLayoutRow,
  type ProductExecutableCacheRow,
  type ProductLocalStorageRow,
  type ProductPermissionsRow,
  type ProductRow,
} from './types';

export const APP_DB_NAME = 'polkadot-desktop-app-v1';

// Full schema at v1. Future bumps append `version(N).stores(SCHEMA_VN).upgrade(fn)`.
const SCHEMA_V1 = {
  products: 'baseName, pinned, createdAt',
  dashboardLayouts: 'id, updatedAt',
  aliasPermissions: 'key',
  productLocalStorage: 'productId',
  productPermissions: 'productId',
  productExecutableCache: 'key, baseName',
} as const;

/**
 * v2 upgrade: permission entries gain `modality`. Every pre-existing decision
 * becomes the App-modality decision; other modalities start absent (read as
 * 'ask'). The `{ modality: 'app', ...p }` spread is idempotent — a row that
 * already carries a modality keeps it — so re-running the upgrade is safe.
 *
 * Exported so the migration test exercises THIS code, not a copy of it: the
 * production schema wiring below and the spec both reference this single
 * function, so a change here can never silently diverge from what is tested.
 */
export async function migrateProductPermissionsToV2(tx: Transaction): Promise<void> {
  await tx
    .table<ProductPermissionsRow>('productPermissions')
    .toCollection()
    .modify(row => {
      // Default the arrays before mapping: a legacy/partially-written row missing
      // either field would otherwise throw inside `.map`, aborting the whole v2
      // upgrade transaction and leaving the DB permanently unopenable.
      row.devicePermissions = (row.devicePermissions ?? []).map(p => ({ modality: 'app', ...p }));
      row.remotePermissions = (row.remotePermissions ?? []).map(p => ({ modality: 'app', ...p }));
    });
}

const dexie = new Dexie(APP_DB_NAME);
dexie.version(1).stores(SCHEMA_V1);
// Indexes are unchanged across v1 → v2, so no .stores() call — only the upgrade fn.
dexie.version(2).upgrade(migrateProductPermissionsToV2);

export const appDatabase = dexie;

export const database = {
  products: dexie.table<ProductRow, string>('products'),
  dashboardLayouts: dexie.table<DashboardLayoutRow, string>('dashboardLayouts'),
  aliasPermissions: dexie.table<AliasPermissionRow, string>('aliasPermissions'),
  productLocalStorage: dexie.table<ProductLocalStorageRow, string>('productLocalStorage'),
  productPermissions: dexie.table<ProductPermissionsRow, string>('productPermissions'),
  productExecutableCache: dexie.table<ProductExecutableCacheRow, string>('productExecutableCache'),
};

export type AppTable<T> = Table<T, string>;

// Branch-era databases consolidated into `polkadot-desktop-app-v1`. Fire-and-
// forget; data is disposable. No ordering constraint vs. the unified DB — the
// unified DB has a distinct name and opens lazily on first access.
// Note: `products-chat` and `p2p-chat` are intentionally excluded — the chat
// domain keeps its own standalone databases (not part of this consolidation).
const LEGACY_DB_NAMES = [
  'polkadot-desktop',
  'alias-permissions',
  'polkadot-desktop-product-local-storage',
  'product-permissions',
  'offline-pins',
];

export async function deleteLegacyDatabases(): Promise<void> {
  await Promise.allSettled(LEGACY_DB_NAMES.map(name => Dexie.delete(name)));
}
