import { asProductId } from '@parity/truapi';
import {
  type DevicePermissionStatus,
  type PermissionAuthorizationRequest,
  type PermissionAuthorizationStatus,
} from '@parity/truapi-host';

import { type PermissionId, PERMISSION_IDS } from './constants';
import { type DevicePermissionType, type OsDevicePermissionStatus, type PermissionStatus } from './types';

const SETTINGS_ID_TO_DEVICE_NAME = {
  Microphone: 'Microphone',
  Camera: 'Camera',
  Bluetooth: 'Bluetooth',
  Location: 'Location',
  Notifications: 'Notifications',
  Clipboard: 'Clipboard',
  OpenExternalUrl: 'OpenUrl',
  Biometrics: 'Biometrics',
  Motion: 'Motion',
} as const satisfies Record<string, DevicePermissionType>;

type StoredDeviceSettingsPermissionId = keyof typeof SETTINGS_ID_TO_DEVICE_NAME;

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

const PERMISSION_ID_SET: ReadonlySet<string> = new Set(PERMISSION_IDS);

function isPermissionId(id: string): id is PermissionId {
  return PERMISSION_ID_SET.has(id);
}

const OS_GATED_DEVICE_PERMISSIONS: readonly string[] = ['Camera', 'Microphone'];

// Device permissions whose actual capture the OS can still block after an in-app grant.
// The bridge only resolves Camera/Microphone on macOS; everything else is granted as decided.
function isOsGatedDevicePermission(permission: string): permission is 'Camera' | 'Microphone' {
  return OS_GATED_DEVICE_PERMISSIONS.includes(permission);
}

function rollupPermissionStatus(statuses: PermissionStatus[]): PermissionStatus {
  if (statuses.includes('granted')) return 'granted';
  if (statuses.includes('denied')) return 'denied';
  return 'ask';
}

/**
 * Settings permission id → the core's `PermissionAuthorizationRequest`.
 *
 * `null` for an id the core has no request shape for, and for an id whose request
 * needs an option the caller did not supply. Never guess: a wrong mapping records a
 * decision against a permission the user never answered.
 *
 * The external-request and account-access kinds are absent from `catalogueRequests`
 * on purpose — their key space is one slot per granted domain or target product, so
 * no single request's status answers for them. Settings derives those rows from the
 * slot index instead.
 */
// The bare host the core keys a remote grant on. The core expands a domain through its
// own RFC-0002 candidate walk (exact, then one wildcard label, then '*') and knows
// nothing of a scheme or port, so both the write and the enforcement read must reduce an
// origin to this same form — a grant stored under a full origin is a key its own lookup
// could never match. A value that is not a parseable URL (an already-bare domain from
// settings) is returned unchanged, so normalization is idempotent.
function hostOf(pattern: string): string {
  try {
    return new URL(pattern).host;
  } catch {
    return pattern;
  }
}

function toAuthorizationRequest(
  permissionId: PermissionId,
  options?: { pattern?: string },
): PermissionAuthorizationRequest | null {
  const deviceName = getDevicePermissionName(permissionId);
  if (deviceName) return { tag: 'Device', value: deviceName };

  switch (permissionId) {
    case 'UserIdentity':
      return { tag: 'IdentityDisclosure' };
    case 'ChainSubmit':
    case 'PreimageSubmit':
    case 'StatementSubmit':
    case 'WebRtc':
    case 'BalanceAccess':
      return { tag: 'Remote', value: { permission: { tag: permissionId } } };
    case 'ExternalRequest':
      if (!options?.pattern) return null;

      return { tag: 'Remote', value: { permission: { tag: 'Remote', value: { domains: [hostOf(options.pattern)] } } } };
    default:
      return null;
  }
}

/**
 * Access to another product's account context, as the core addresses it.
 *
 * Not reachable through `toAuthorizationRequest`: this is keyed by the target product
 * rather than by a catalogue id, and `'Alias'` — the settings row it renders as — is
 * not a member of `PERMISSION_IDS`.
 */
function toAccountAccessRequest(targetProductId: string): PermissionAuthorizationRequest {
  return { tag: 'AccountAccess', value: { targetProductId: asProductId(targetProductId) } };
}

/** The inverse of `toAuthorizationRequest`, for naming a slot the core handed back. */
function fromAuthorizationRequest(request: PermissionAuthorizationRequest): PermissionId | null {
  switch (request.tag) {
    case 'Device': {
      const settingsId = getSettingsPermissionId(request.value);

      return isPermissionId(settingsId) ? settingsId : null;
    }
    case 'IdentityDisclosure':
      return 'UserIdentity';
    case 'AccountAccess':
      // Keyed by target product, not by a catalogue id — read it through
      // `permissionSlots$` instead of naming it here.
      return null;
    case 'Remote': {
      const permission = request.value.permission;
      if (permission.tag === 'Remote') return 'ExternalRequest';

      return isPermissionId(permission.tag) ? permission.tag : null;
    }
    default:
      return null;
  }
}

function toAuthorizationStatus(status: PermissionStatus): PermissionAuthorizationStatus {
  switch (status) {
    case 'granted':
      return 'Authorized';
    case 'denied':
      return 'Denied';
    case 'ask':
      // Not "no opinion we forgot to record" — it is the host asking the core to
      // prompt again, which is what resetting a permission in settings means.
      return 'NotDetermined';
  }
}

function fromAuthorizationStatus(status: PermissionAuthorizationStatus): PermissionStatus {
  switch (status) {
    case 'Authorized':
      return 'granted';
    case 'Denied':
      return 'denied';
    case 'NotDetermined':
      return 'ask';
  }
}

/** The main process's OS device-access status in the core's vocabulary. */
function toDevicePermissionStatus(status: OsDevicePermissionStatus): DevicePermissionStatus {
  switch (status) {
    case 'granted':
      return 'Granted';
    case 'denied':
      return 'Denied';
    case 'not-determined':
      return 'NotDetermined';
    case 'not-applicable':
      return 'NotApplicable';
  }
}

/**
 * One request per catalogue id whose key is fixed, for the single batched read that
 * backs a product's settings page. Ids with an unbounded key space are excluded; see
 * `toAuthorizationRequest`.
 */
function catalogueRequests(): PermissionAuthorizationRequest[] {
  return PERMISSION_IDS.flatMap(id => {
    const request = toAuthorizationRequest(id);

    return request ? [request] : [];
  });
}

export const permissionsService = {
  toAuthorizationRequest,
  toAccountAccessRequest,
  fromAuthorizationRequest,
  toAuthorizationStatus,
  fromAuthorizationStatus,
  toDevicePermissionStatus,
  catalogueRequests,
  isStoredAsDevicePermission,
  getDevicePermissionName,
  getSettingsPermissionId,
  isPermissionId,
  isOsGatedDevicePermission,
  rollupPermissionStatus,
};
