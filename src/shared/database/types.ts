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

export type AliasPermissionRow = {
  key: string;
  requesterProductId: string;
  requestedContextId: string;
  status: string;
};

export type ProductPermissionsRow = {
  productId: string;
  devicePermissions: { payload: { name: string }; modality?: string; status: string }[];
  remotePermissions: { payload: Record<string, unknown>; modality?: string; status: string }[];
};

export type ProductLocalStorageRow = {
  productId: string;
  data: Record<string, Uint8Array>;
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

export type AppTableName =
  | 'products'
  | 'dashboardLayouts'
  | 'aliasPermissions'
  | 'productLocalStorage'
  | 'productPermissions'
  | 'productExecutableCache';
