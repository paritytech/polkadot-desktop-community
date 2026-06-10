import * as v from 'valibot';

const permissionStatusSchema = v.picklist(['ask', 'granted', 'denied']);

// Rows written before the per-modality migration have no `modality` — they are
// App-modality decisions by definition. Normalize at the trust boundary.
const permissionModalitySchema = v.optional(v.picklist(['app', 'widget']), 'app');

const devicePermissionSchema = v.object({
  payload: v.object({
    name: v.picklist([
      'Notifications',
      'Camera',
      'Microphone',
      'Bluetooth',
      'NFC',
      'Location',
      'Clipboard',
      'OpenUrl',
      'Biometrics',
    ]),
  }),
  modality: permissionModalitySchema,
  status: permissionStatusSchema,
});

const remotePermissionSchema = v.object({
  payload: v.union([
    v.object({ type: v.literal('Remote'), pattern: v.string() }),
    v.object({ type: v.literal('ChainSubmit') }),
    v.object({ type: v.literal('PreimageSubmit') }),
    v.object({ type: v.literal('StatementSubmit') }),
    v.object({ type: v.literal('WebRtc') }),
    v.object({ type: v.literal('UserIdentity') }),
  ]),
  modality: permissionModalitySchema,
  status: permissionStatusSchema,
});

export const productPermissionsSchema = v.object({
  productId: v.string(),
  devicePermissions: v.array(devicePermissionSchema),
  remotePermissions: v.array(remotePermissionSchema),
});
