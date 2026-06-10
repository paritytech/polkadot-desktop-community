// Canonical permission identifiers — the settings/metadata vocabulary. The
// presentational metadata (icons, labels) keyed by these ids lives in the UI
// layer (@/widgets/Permission); the domain owns only the identity taxonomy.
export const PERMISSION_IDS = [
  'Clipboard',
  'Microphone',
  'Camera',
  'Notifications',
  'Bluetooth',
  'Location',
  'Biometrics',
  'OpenExternalUrl',
  'ExternalRequest',
  'WebRtc',
  'ChainSubmit',
  'PreimageSubmit',
  'StatementSubmit',
  'UserIdentity',
  'Files',
] as const;

export type PermissionId = (typeof PERMISSION_IDS)[number];

// Protocol / storage permission ids that normalize onto a canonical settings id.
// The `OpenUrl → OpenExternalUrl` entry is the inverse of `OpenExternalUrl → 'OpenUrl'`
// in service.ts's SETTINGS_ID_TO_DEVICE_NAME; keep the two consistent if the host
// renames that device permission. (Not derived here: this leaf can't import the
// service, and the other two aliases have no device-name counterpart.)
export const PERMISSION_ID_ALIASES: Record<string, PermissionId> = {
  OpenUrl: 'OpenExternalUrl',
  TransactionSubmit: 'ChainSubmit',
  Remote: 'ExternalRequest',
};

// User-facing access surfaces a permission can be granted through. Order is the
// settings display order. `worker` is an executable kind but NOT a modality —
// worker-originated requests are enforced against 'app'. Future kinds (pocket,
// chats) extend this union.
export const PERMISSION_MODALITIES = ['app', 'widget'] as const;

export type PermissionModality = (typeof PERMISSION_MODALITIES)[number];
