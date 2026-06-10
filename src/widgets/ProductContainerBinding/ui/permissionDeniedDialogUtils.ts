import { type PermissionId, permissionsService } from '@/domains/product';

const PERMISSION_DENIED_KEY_BY_META_ID: Partial<Record<PermissionId, string>> = {
  OpenExternalUrl: 'OpenUrl',
};

const PERMISSION_DENIED_KEYS = new Set<string>([
  'Camera',
  'Microphone',
  'Bluetooth',
  'Location',
  'Notifications',
  'Biometrics',
  'Clipboard',
  'Files',
  'OpenUrl',
  'ExternalRequest',
  'Remote',
  'TransactionSubmit',
  'ChainSubmit',
  'PreimageSubmit',
  'StatementSubmit',
]);

export const toPermissionDeniedKey = (permission: string): string => {
  const metaId = permissionsService.resolvePermissionMetaId(permission);
  if (!metaId) return permission;

  return PERMISSION_DENIED_KEY_BY_META_ID[metaId] ?? metaId;
};

export const toPermissionMetaId = (permission: string): PermissionId | undefined => {
  return permissionsService.resolvePermissionMetaId(permission);
};

export const hasPermissionDeniedCopy = (permission: string): boolean => {
  return PERMISSION_DENIED_KEYS.has(toPermissionDeniedKey(permission));
};
