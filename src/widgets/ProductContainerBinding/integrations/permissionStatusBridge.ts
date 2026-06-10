import { type PermissionStatus, type RemotePermissionRequest } from '@/domains/product';

export function resolvePermissionStatus(
  localOverride: PermissionStatus | undefined,
  persistedStatus: PermissionStatus | undefined,
): PermissionStatus {
  return localOverride ?? persistedStatus ?? 'ask';
}

export function getRemoteStatusKey(request: RemotePermissionRequest): string {
  if (request.tag === 'Remote') {
    return `Remote:${[...request.value].sort().join('\0')}`;
  }
  return request.tag;
}

export function createPermissionStatusBridge() {
  const overrides = new Map<string, PermissionStatus>();

  return {
    setOverride(key: string, status: PermissionStatus) {
      overrides.set(key, status);
    },
    getStatus(key: string, getPersisted: () => PermissionStatus | undefined): PermissionStatus {
      return resolvePermissionStatus(overrides.get(key), getPersisted());
    },
  };
}
