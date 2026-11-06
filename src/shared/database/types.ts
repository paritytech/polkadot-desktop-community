import { type HexString } from '@/shared/types';

// Storage-row types are OWNED here, deliberately decoupled from domain types:
// `@/shared` may not import `@/domains`. String-literal-union fields collapse
// to `string` and branded ids collapse to their base; the domain layer
// reconstructs the precise types on read via Valibot (`schemas.ts`).

export type ProductExecutableRow = {
  kind: string;
  identifier: string;
  contenthash: HexString;
  appVersion: (number | string)[];
  // widget
  dimensions?: { height: number[]; width?: number };
  // worker
  entrypoint?: string;
  includes?: { chat: boolean; pocket: boolean };
  description?: string;
};

export type ProductRow = {
  baseName: string;
  displayName: string;
  description: string;
  icon: { cid: string; format: string };
  executables: { app?: ProductExecutableRow; widget?: ProductExecutableRow; worker?: ProductExecutableRow };
  owner?: HexString;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
};

export type DashboardLayoutItemRow = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  resizeHandles?: string[];
  type?: string;
  folderItems?: string[];
  folderItemPositions?: Record<string, { x: number; y: number }>;
  payload?: { kind: string; [key: string]: unknown };
};

export type DashboardLayoutRow = {
  id: string;
  pages?: DashboardLayoutItemRow[][];
  items?: DashboardLayoutItemRow[];
  activePageIndex?: number;
  updatedAt: number;
};

// Survives its table: `migrateProductPermissionsToV2` is typed with it, and that
// upgrade must keep working for a database still at v1.
export type ProductPermissionsRow = {
  productId: string;
  devicePermissions: { payload: { name: string }; modality?: string; status: string }[];
  remotePermissions: { payload: Record<string, unknown>; modality?: string; status: string }[];
};

export type ProductStorageRow = {
  key: string; // the core-namespaced key, opaque to the host
  value: Uint8Array;
};

export type CoreStorageRow = {
  key: string; // hex of the SCALE-encoded CoreStorageKey
  value: Uint8Array;
  // The key's own decoded fields. Optional: rows written before schema v9 have
  // none of them. They never participate in the core's own lookup, which is by
  // `key` alone.
  slotTag?: string;
  productId?: string;
  productLabel?: string;
  request?: Uint8Array; // SCALE-encoded by the core's own codec
};

export type ProductExecutableCacheRow = {
  key: string; // `${baseName}#${kind}`
  baseName: string;
  kind: string;
  domain: string;
  contenthash: HexString;
  status: string; // 'preparing' | 'ready' | 'failed'
  sizeBytes: number;
  updatedAt: number;
};

export type DeclinedUpdateRow = {
  key: string; // `${baseName}#${kind}#${contenthash}`
  baseName: string;
  kind: string;
  contenthash: HexString;
  version: (number | string)[];
  declinedAt: number;
};

export type DeviceIdentityRow = {
  id: string; // always the single-row id — the store holds exactly one row
  statementAccountSeed: Uint8Array;
  encryptionPrivateKey: Uint8Array;
  createdAt: number;
};

export type ThemeSettingsRow = {
  id: string; // always the single-row id — the store holds exactly one row
  preference: string;
  name: string;
};

/**
 * One chain's smoldot finalized-state database, so its light client resumes instead
 * of syncing from the chain-spec checkpoint on every launch.
 *
 * Disposable: losing a row costs a resync, never correctness.
 */
export type LightClientDatabaseRow = {
  genesisHash: string;
  blob: string;
  updatedAt: number;
};

export type AppTableName =
  | 'products'
  | 'dashboardLayouts'
  | 'productStorage'
  | 'productExecutableCache'
  | 'declinedUpdates'
  | 'coreStorage'
  | 'deviceIdentity'
  | 'themeSettings'
  | 'lightClientDatabases';
