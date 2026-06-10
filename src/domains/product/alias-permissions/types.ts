import { type PermissionStatus } from '../permissions/types';

// Alias decisions share the permission decision vocabulary (`ask`/`granted`/`denied`).
export type AliasPermissionStatus = PermissionStatus;

export type AliasPermission = {
  key: string;
  requesterProductId: string;
  requestedContextId: string;
  status: Exclude<AliasPermissionStatus, 'ask'>;
};
