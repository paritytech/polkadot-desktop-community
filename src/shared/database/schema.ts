import Dexie, { type Table, type Transaction } from 'dexie';

import { migrateProductStorageToV12 } from './migrations';
import {
  type CoreStorageRow,
  type DashboardLayoutRow,
  type DeclinedUpdateRow,
  type DeviceIdentityRow,
  type LightClientDatabaseRow,
  type ProductExecutableCacheRow,
  type ProductPermissionsRow,
  type ProductRow,
  type ProductStorageRow,
  type ThemeSettingsRow,
} from './types';

export const APP_DB_NAME = 'polkadot-desktop-app-v1';

// Full schema at v1. Later bumps append `version(N).stores(<delta>)`, with `.upgrade(fn)` when rows move.
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
// v3: additive store for per-(product,kind,version) update declines. Keyed by
// contenthash so a NEWER version (new contenthash → new key) re-surfaces after a
// decline. No .upgrade() fn needed — a brand-new store has nothing to migrate.
dexie.version(3).stores({ declinedUpdates: 'key, baseName' });
// v4: additive store for the per-(session, product) subtree key fetched from the
// paired device (RFC-0022). Keyed `${sessionId}:${productId}` so a re-pair cannot
// serve the previous pairing's key. No .upgrade() fn — a brand-new store has
// nothing to migrate.
dexie.version(4).stores({ productSubtrees: 'key, sessionId, productId' });
// v5: additive store for host-private slots owned by the TrUAPI core (auth session,
// pairing device identity, permission authorizations, allowance keys). The core
// addresses them by an opaque SCALE-encoded key which we hex-encode, so the host
// never interprets the contents. No .upgrade() fn — a brand-new store has nothing
// to migrate.
dexie.version(5).stores({ coreStorage: 'key' });
// v6: additive single-row store for this device's own keys. The host mints and keeps
// them itself — they identify this install in the multi-device protocol and are not
// derivable from the paired session. No .upgrade() fn — a brand-new store has nothing
// to migrate.
dexie.version(6).stores({ deviceIdentity: 'id' });
// v7: `productSubtrees` is dropped. The TrUAPI core derives product accounts itself,
// so nothing writes or reads the store; `null` deletes it. The rows held public keys
// only, so there is nothing to migrate out first.
dexie.version(7).stores({ productSubtrees: null });
// v8: additive single-row store for the theme the user picked. Moved off localStorage
// so the setting is read and written through the same database as everything else and
// the resource can observe it with liveQuery instead of a window event. No .upgrade()
// fn — the previous localStorage values are not carried over.
dexie.version(8).stores({ themeSettings: 'id' });
// v9: `coreStorage` gains indexes on the key's own decoded fields, so the host can ask
// which permission slots it holds — a question the core's point-lookup API cannot
// answer. Indexes only, no `.upgrade()`. Rows written before v9 carry none of the new
// columns and are backfilled once at bootstrap, not here: decoding a key needs the
// TrUAPI codec, and `@/shared` may not know TrUAPI vocabulary.
dexie.version(9).stores({ coreStorage: 'key, slotTag, productId, [slotTag+productId]' });
// v10: `productPermissions` and `aliasPermissions` are dropped. The TrUAPI core owns
// every permission decision and persists it through the host's own `coreStorage`
// callbacks, so a second host-side copy could only disagree with it. `null` deletes the
// store. Decisions already made are NOT migrated: the core has never seen them, and
// re-prompting is the honest outcome of the host no longer being an authority.
dexie.version(10).stores({ productPermissions: null, aliasPermissions: null });
// v11: warm-start blobs for the embedded light client, keyed by genesis hash. A new
// store needs no `.upgrade()` — there is nothing to migrate. The rows are disposable
// smoldot state: dropping one costs a resync of that chain, never correctness.
dexie.version(11).stores({ lightClientDatabases: 'genesisHash' });
// v12: product storage becomes one row per key, replacing the single legacy row that
// held every entry. A write is then one atomic put and never re-saves other data; only
// the one row the host used was ever read by the core, so only it is carried over. The
// old store is read inside this upgrade and deleted after it.
dexie.version(12).stores({ productStorage: 'key', productLocalStorage: null }).upgrade(migrateProductStorageToV12);
// v13: `coreStorage` gains a `productLabel` index. TrUAPI 0.29 files some slots under a
// bare product label rather than a full product id, and the product sweep has to find
// them. Index only. The bootstrap backfill describes rows that carry no owner yet; a
// row that already holds a `productId` keeps it and is still swept by it.
dexie.version(13).stores({ coreStorage: 'key, slotTag, productId, productLabel, [slotTag+productId]' });

export const appDatabase = dexie;

export const database = {
  products: dexie.table<ProductRow, string>('products'),
  dashboardLayouts: dexie.table<DashboardLayoutRow, string>('dashboardLayouts'),
  productStorage: dexie.table<ProductStorageRow, string>('productStorage'),
  productExecutableCache: dexie.table<ProductExecutableCacheRow, string>('productExecutableCache'),
  declinedUpdates: dexie.table<DeclinedUpdateRow, string>('declinedUpdates'),
  coreStorage: dexie.table<CoreStorageRow, string>('coreStorage'),
  deviceIdentity: dexie.table<DeviceIdentityRow, string>('deviceIdentity'),
  themeSettings: dexie.table<ThemeSettingsRow, string>('themeSettings'),
  lightClientDatabases: dexie.table<LightClientDatabaseRow, string>('lightClientDatabases'),
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
