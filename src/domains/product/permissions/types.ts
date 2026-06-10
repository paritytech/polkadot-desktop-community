import {
  type CodecType,
  type DevicePermission as DevicePermissionCodec,
  type RemotePermission as RemotePermissionCodec,
} from '@novasamatech/host-api';

import { type ExecutableKind } from '../product/manifest/constants';

import { type PermissionModality } from './constants';

export type DevicePermissionType = CodecType<typeof DevicePermissionCodec>;
export type RemotePermissionType = CodecType<typeof RemotePermissionCodec>;

export type PermissionStatus = 'ask' | 'granted' | 'denied';

export type DevicePermissionId = 'Microphone' | 'Camera' | 'Bluetooth' | 'Location';

export type Permission<Payload> = {
  payload: Payload;
  modality: PermissionModality;
  status: PermissionStatus;
};

export type DevicePermission = Permission<{ name: DevicePermissionType }>;

export type RemotePermission = Permission<
  | {
      type: 'Remote';
      pattern: string;
    }
  | {
      type: 'ChainSubmit';
    }
  | {
      type: 'PreimageSubmit';
    }
  | {
      type: 'StatementSubmit';
    }
  | {
      type: 'WebRtc';
    }
  | {
      type: 'UserIdentity';
    }
>;

export type StoredRemotePermissionType = Exclude<RemotePermission['payload']['type'], 'Remote'>;

export type RemotePermissionRequest = { tag: 'Remote'; value: string[] } | { tag: StoredRemotePermissionType };

export type ProductPermissions = {
  productId: string;
  devicePermissions: DevicePermission[];
  remotePermissions: RemotePermission[];
};

// One product's standing on a single permission, used by the cross-product
// aggregation. `patterns` is populated only for ExternalRequest.
export type AppPermissionEntry = {
  productId: string;
  // Roll-up across modalities: 'granted' if any granted, else 'denied' if any denied, else 'ask'.
  status: PermissionStatus;
  // Modalities with granted status (for ExternalRequest: ≥1 granted pattern).
  allowedModalities: PermissionModality[];
  patterns?: { pattern: string; modality: PermissionModality; status: PermissionStatus }[];
};

// A permission rolled up across every product that has touched it.
export type AggregatedPermission = {
  id: string;
  grantedCount: number;
  apps: AppPermissionEntry[];
};

export type RemotePermissionIpcRequest = {
  productId: string;
  executable: ExecutableKind;
  request: { tag: 'Remote'; url: string } | { tag: 'ChainSubmit' };
};
