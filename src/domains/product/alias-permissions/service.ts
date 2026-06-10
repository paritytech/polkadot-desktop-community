import { type AliasPermission } from './types';

function getPermissionKey(requesterProductId: string, requestedContextId: string) {
  return `${requesterProductId}::${requestedContextId}`;
}

function findPermission(permissions: AliasPermission[], requesterProductId: string, requestedContextId: string) {
  const key = getPermissionKey(requesterProductId, requestedContextId);
  return permissions.find(permission => permission.key === key) ?? null;
}

function getStatus(permissions: AliasPermission[], requesterProductId: string, requestedContextId: string) {
  return findPermission(permissions, requesterProductId, requestedContextId)?.status ?? 'ask';
}

export const aliasPermissionService = {
  getPermissionKey,
  getStatus,
};
