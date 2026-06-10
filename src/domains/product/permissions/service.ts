import { type ExecutableKind } from '../product/manifest/constants';
import { type ProductExecutables } from '../product/manifest/types';

import {
  type PermissionId,
  type PermissionModality,
  PERMISSION_IDS,
  PERMISSION_ID_ALIASES,
  PERMISSION_MODALITIES,
} from './constants';
import {
  type AggregatedPermission,
  type AppPermissionEntry,
  type DevicePermission,
  type DevicePermissionId,
  type DevicePermissionType,
  type Permission,
  type PermissionStatus,
  type ProductPermissions,
  type RemotePermission,
  type RemotePermissionRequest,
  type StoredRemotePermissionType,
} from './types';

const DEVICE_PERMISSION_IDS: ReadonlySet<string> = new Set<DevicePermissionId>(['Microphone', 'Camera', 'Bluetooth', 'Location']);

const STORED_REMOTE_PERMISSION_TYPES: ReadonlySet<string> = new Set<StoredRemotePermissionType>([
  'ChainSubmit',
  'PreimageSubmit',
  'StatementSubmit',
  'WebRtc',
  'UserIdentity',
]);

/** Settings permission id → persisted device permission name (host-api `DevicePermission`). */
const SETTINGS_ID_TO_DEVICE_NAME = {
  Microphone: 'Microphone',
  Camera: 'Camera',
  Bluetooth: 'Bluetooth',
  Location: 'Location',
  Notifications: 'Notifications',
  Clipboard: 'Clipboard',
  OpenExternalUrl: 'OpenUrl',
  Biometrics: 'Biometrics',
} as const satisfies Record<string, DevicePermissionType>;

type StoredDeviceSettingsPermissionId = keyof typeof SETTINGS_ID_TO_DEVICE_NAME;

function isDevicePermissionId(id: string): id is DevicePermissionId {
  return DEVICE_PERMISSION_IDS.has(id);
}

/** Settings ids persisted as non-pattern remote permissions (`RemotePermission` minus `Remote`). */
function isStoredRemotePermissionType(id: string): id is StoredRemotePermissionType {
  return STORED_REMOTE_PERMISSION_TYPES.has(id);
}

function isStoredAsDevicePermission(settingsPermissionId: string): settingsPermissionId is StoredDeviceSettingsPermissionId {
  return settingsPermissionId in SETTINGS_ID_TO_DEVICE_NAME;
}

function getDevicePermissionName(settingsPermissionId: string): DevicePermissionType | null {
  if (!isStoredAsDevicePermission(settingsPermissionId)) return null;
  return SETTINGS_ID_TO_DEVICE_NAME[settingsPermissionId];
}

function getSettingsPermissionId(devicePermissionName: DevicePermissionType): string {
  for (const [settingsId, name] of Object.entries(SETTINGS_ID_TO_DEVICE_NAME)) {
    if (name === devicePermissionName) {
      return settingsId;
    }
  }

  return devicePermissionName;
}

const VALID_STATUSES: ReadonlySet<string> = new Set<PermissionStatus>(['ask', 'granted', 'denied']);

function isPermissionStatus(value: string): value is PermissionStatus {
  return VALID_STATUSES.has(value);
}

type ExternalRequestPermission = Permission<Extract<RemotePermission['payload'], { type: 'Remote' }>>;

function getExternalRequestPermissions(
  permissions: ProductPermissions | null,
  modality?: PermissionModality,
): ExternalRequestPermission[] {
  if (!permissions) return [];

  return permissions.remotePermissions.filter(
    (p): p is ExternalRequestPermission => p.payload.type === 'Remote' && (!modality || p.modality === modality),
  );
}

/**
 * Matches a URL against a permission pattern with support for wildcard subdomains
 * and path-based restrictions.
 *
 * Pattern matching rules:
 * - Protocol must match exactly (https vs http)
 * - Hostname supports `*` wildcard for single-level subdomains
 * - Path is matched as a prefix match (pattern `/v1` matches `/v1/users`)
 *
 * @param pattern - Permission pattern (e.g., 'https://*.example.com/api')
 * @param url - URL to test against the pattern
 * @returns true if the URL matches the permission pattern
 */
function matchesUrlPermission(pattern: string, url: string): boolean {
  let patternUrl: URL;
  let requestUrl: URL;

  try {
    patternUrl = new URL(pattern);
    requestUrl = new URL(url);
  } catch {
    return false;
  }

  if (patternUrl.protocol !== requestUrl.protocol) return false;

  const patternHost = patternUrl.hostname;
  const requestHost = requestUrl.hostname;

  if (patternHost.includes('*')) {
    // * matches exactly one DNS label (no dots)
    const regexStr = patternHost
      .split('.')
      .map(part => (part === '*' ? '[^.]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .join('\\.');

    if (!new RegExp(`^${regexStr}$`).test(requestHost)) return false;
  } else if (patternHost !== requestHost) {
    return false;
  }

  const patternPath = patternUrl.pathname;
  const requestPath = requestUrl.pathname;

  if (patternPath !== '/') {
    const isExactMatch = requestPath === patternPath;
    const isPrefixMatch = requestPath.startsWith(patternPath) && requestPath[patternPath.length] === '/';

    if (!isExactMatch && !isPrefixMatch) return false;
  }

  return true;
}

/**
 * Enforcement-gate status for a single in-flight remote request, scoped to one
 * modality. For a `Remote` request (a set of URLs matched against stored
 * patterns) the precedence is deliberately CONSERVATIVE and the inverse of the
 * settings-display roll-up (`rollupPermissionStatus`):
 *
 * - gate (here):                only 'granted' if EVERY matching pattern is
 *                               granted; ANY denied match ⇒ 'denied' (deny-wins).
 * - display (`rollupPermissionStatus`): grant-wins — ANY granted ⇒ 'granted'.
 *
 * They answer different questions and MUST stay different: the gate authorizes
 * one concrete request and must not let a single granted pattern wave through a
 * URL that another pattern explicitly denies; the display summarizes "does this
 * product hold any grant for this permission". `undefined` here means "no stored
 * decision applies" — the caller then prompts. See the mixed-precedence tests in
 * service.spec.ts.
 */
function getRemotePermissionRequestStatus(
  permissions: ProductPermissions | null | undefined,
  request: RemotePermissionRequest,
  modality: PermissionModality,
): PermissionStatus | undefined {
  if (!permissions) return undefined;

  if (request.tag === 'Remote') {
    const matching = permissions.remotePermissions.filter(entry => {
      if (entry.modality !== modality) return false;
      const payload = entry.payload;
      if (payload.type !== 'Remote') return false;
      return request.value.some(value => matchesUrlPermission(payload.pattern, value));
    });

    if (matching.length === 0) return undefined;
    if (matching.every(entry => entry.status === 'granted')) return 'granted';
    if (matching.some(entry => entry.status === 'denied')) return 'denied';
    return 'ask';
  }

  return permissions.remotePermissions.find(entry => entry.payload.type === request.tag && entry.modality === modality)?.status;
}

function buildRemotePermissionsToStore(
  request: RemotePermissionRequest,
  status: PermissionStatus,
  modality: PermissionModality,
): RemotePermission[] {
  if (request.tag === 'Remote') {
    return request.value.map(pattern => ({ payload: { type: 'Remote', pattern }, modality, status }));
  }

  return [{ payload: { type: request.tag }, modality, status }];
}

function upsertRemotePermission(draft: ProductPermissions, permission: RemotePermission): void {
  let entry: RemotePermission | undefined;

  if (permission.payload.type === 'Remote') {
    const request = permission.payload;
    entry = draft.remotePermissions.find(
      p => p.payload.type === 'Remote' && p.payload.pattern === request.pattern && p.modality === permission.modality,
    );
  } else {
    entry = draft.remotePermissions.find(p => p.payload.type === permission.payload.type && p.modality === permission.modality);
  }

  if (entry) {
    entry.status = permission.status;
  } else {
    draft.remotePermissions.push(permission);
  }
}

function upsertDevicePermission(draft: ProductPermissions, permission: DevicePermission): void {
  const entry = draft.devicePermissions.find(
    p => p.payload.name === permission.payload.name && p.modality === permission.modality,
  );

  if (entry) {
    entry.status = permission.status;
  } else {
    draft.devicePermissions.push(permission);
  }
}

const PERMISSION_ID_SET: ReadonlySet<string> = new Set(PERMISSION_IDS);

function isPermissionId(id: string): id is PermissionId {
  return PERMISSION_ID_SET.has(id);
}

/** Normalizes a protocol / storage permission id to its canonical settings id. */
function resolvePermissionMetaId(id: string): PermissionId | undefined {
  if (id.startsWith('http://') || id.startsWith('https://')) return 'ExternalRequest';

  const metaId = PERMISSION_ID_ALIASES[id] ?? id;

  return isPermissionId(metaId) ? metaId : undefined;
}

/**
 * Settings-display roll-up across a product's entries for one permission:
 * grant-wins (granted beats denied beats ask). This is intentionally the
 * OPPOSITE precedence to the enforcement gate `getRemotePermissionRequestStatus`
 * (deny-wins) — see that function's doc for why the two must not be unified.
 * Used only for the aggregated "is anything granted" view, never to authorize a
 * live request.
 */
function rollupPermissionStatus(statuses: PermissionStatus[]): PermissionStatus {
  if (statuses.includes('granted')) return 'granted';
  if (statuses.includes('denied')) return 'denied';
  return 'ask';
}

/**
 * Modalities a product can be granted permissions through, in display order.
 * Derived from manifest executables (worker is not a modality). Fallback for
 * unresolvable permission-only products: modalities present in stored entries,
 * else ['app']. Pure — both inputs are supplied by the caller.
 */
function permissionModalitiesForProduct(
  executables: ProductExecutables | null,
  stored: ProductPermissions | null,
): PermissionModality[] {
  const declared = PERMISSION_MODALITIES.filter(modality => executables?.[modality]);
  if (declared.length > 0) return declared;

  const storedModalities = new Set(
    [...(stored?.devicePermissions ?? []), ...(stored?.remotePermissions ?? [])].map(entry => entry.modality),
  );
  const fromStored = PERMISSION_MODALITIES.filter(modality => storedModalities.has(modality));

  return fromStored.length > 0 ? fromStored : ['app'];
}

/**
 * Permission modality an executable kind's requests are enforced against.
 * `worker` is an executable kind but NOT a modality — worker-originated
 * requests are enforced against 'app' (see constants.ts / domain README).
 */
function modalityForKind(kind: ExecutableKind): PermissionModality {
  return kind === 'widget' ? 'widget' : 'app';
}

/**
 * Stored status of one device permission (host-api name) for one modality, or
 * undefined when nothing is stored. The single (name, modality) matching rule —
 * the IPC gate, the SDK path, and the settings read all resolve through here.
 */
function getDevicePermissionStatus(
  permissions: ProductPermissions | null | undefined,
  deviceName: DevicePermissionType,
  modality: PermissionModality,
): PermissionStatus | undefined {
  return permissions?.devicePermissions.find(p => p.payload.name === deviceName && p.modality === modality)?.status;
}

/** Stored status of one settings permission for one modality; absent entry = ask. */
function getPermissionStatusForModality(
  permissions: ProductPermissions | null,
  settingsPermissionId: string,
  modality: PermissionModality,
): PermissionStatus {
  if (!permissions) return 'ask';

  const deviceName = getDevicePermissionName(settingsPermissionId);
  if (deviceName) {
    const device = getDevicePermissionStatus(permissions, deviceName, modality);
    if (device) return device;
  }

  const remote = permissions.remotePermissions.find(p => p.payload.type === settingsPermissionId && p.modality === modality);
  if (remote) return remote.status;

  return 'ask';
}

/**
 * Resets every stored entry (all modalities) for a settings permission id back
 * to the default. Device and remote-type entries are removed (absence reads as
 * 'ask'); ExternalRequest web-domain patterns are kept and reverted to 'ask' so
 * the user's remembered domain list survives a reset.
 */
function removePermissionEntries(draft: ProductPermissions, settingsPermissionId: string): void {
  const deviceName = getDevicePermissionName(settingsPermissionId);
  if (deviceName) {
    draft.devicePermissions = draft.devicePermissions.filter(p => p.payload.name !== deviceName);
  }

  if (settingsPermissionId === 'ExternalRequest') {
    for (const entry of draft.remotePermissions) {
      if (entry.payload.type === 'Remote') entry.status = 'ask';
    }
    return;
  }

  draft.remotePermissions = draft.remotePermissions.filter(p => p.payload.type !== settingsPermissionId);
}

type AppExtractor = (perms: ProductPermissions) => AppPermissionEntry | null;

function modalitiesWithGrant(entries: { modality: PermissionModality; status: PermissionStatus }[]): PermissionModality[] {
  return PERMISSION_MODALITIES.filter(modality =>
    entries.some(entry => entry.modality === modality && entry.status === 'granted'),
  );
}

// Cross-modality roll-up of one product's entries for one permission.
function buildAppEntry(
  productId: string,
  entries: { modality: PermissionModality; status: PermissionStatus }[],
): AppPermissionEntry | null {
  if (entries.length === 0) return null;
  return {
    productId,
    status: rollupPermissionStatus(entries.map(e => e.status)),
    allowedModalities: modalitiesWithGrant(entries),
  };
}

const deviceExtractor =
  (name: string): AppExtractor =>
  perms =>
    buildAppEntry(
      perms.productId,
      perms.devicePermissions.filter(p => p.payload.name === name),
    );

const remoteExtractor =
  (type: string): AppExtractor =>
  perms =>
    buildAppEntry(
      perms.productId,
      perms.remotePermissions.filter(p => p.payload.type === type),
    );

const externalRequestExtractor: AppExtractor = perms => {
  const patterns = getExternalRequestPermissions(perms).map(e => ({
    pattern: e.payload.pattern,
    modality: e.modality,
    status: e.status,
  }));
  const entry = buildAppEntry(perms.productId, patterns);
  return entry ? { ...entry, patterns } : null;
};

function getExtractor(metaId: PermissionId): AppExtractor {
  if (metaId === 'ExternalRequest') return externalRequestExtractor;

  const deviceName = getDevicePermissionName(metaId);
  if (deviceName) return deviceExtractor(deviceName);

  // WebRtc, ChainSubmit, PreimageSubmit, StatementSubmit read from remotePermissions.
  // Files is UI-only (not a host-api DevicePermission) and also falls through here.
  return remoteExtractor(metaId);
}

function aggregateForId(metaId: PermissionId, allPermissions: ProductPermissions[]): AggregatedPermission {
  const extract = getExtractor(metaId);
  const apps: AppPermissionEntry[] = [];
  let grantedCount = 0;

  for (const perms of allPermissions) {
    const entry = extract(perms);
    if (entry) {
      if (entry.status === 'granted') grantedCount++;
      apps.push(entry);
    }
  }

  return { id: metaId, grantedCount, apps };
}

/** Every known permission rolled up across all products. */
function aggregatePermissions(allPermissions: ProductPermissions[]): AggregatedPermission[] {
  return PERMISSION_IDS.map(id => aggregateForId(id, allPermissions));
}

/** A single permission rolled up across all products, or null for an unknown id. */
function aggregatePermission(permissionId: string, allPermissions: ProductPermissions[]): AggregatedPermission | null {
  if (!isPermissionId(permissionId)) return null;
  return aggregateForId(permissionId, allPermissions);
}

export const permissionsService = {
  isDevicePermissionId,
  isStoredAsDevicePermission,
  isStoredRemotePermissionType,
  getDevicePermissionName,
  getSettingsPermissionId,
  isPermissionStatus,
  isPermissionId,
  resolvePermissionMetaId,
  matchesUrlPermission,
  getExternalRequestPermissions,
  getRemotePermissionRequestStatus,
  buildRemotePermissionsToStore,
  upsertRemotePermission,
  upsertDevicePermission,
  aggregatePermissions,
  aggregatePermission,
  rollupPermissionStatus,
  modalityForKind,
  permissionModalitiesForProduct,
  getDevicePermissionStatus,
  getPermissionStatusForModality,
  removePermissionEntries,
};
