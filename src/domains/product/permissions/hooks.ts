import { useMemo } from 'react';

import { useAction, useRead } from '@/shared/hooks';

import { type PermissionModality } from './constants';
import {
  allProductPermissionsResource,
  productPermissionsResource,
  resetPermissionToDefault,
  setDevicePermission,
  setRemotePermission,
  setRemotePermissionsBatch,
} from './resource';
import { permissionsService } from './service';

export const useSetDevicePermission = () => {
  return useAction(setDevicePermission);
};

export const useSetRemotePermission = () => {
  return useAction(setRemotePermission);
};

export const useSetRemotePermissionsBatch = () => {
  return useAction(setRemotePermissionsBatch);
};

export const useResetPermissionToDefault = () => {
  return useAction(resetPermissionToDefault);
};

export const useAllProductPermissions = () => {
  return useRead(allProductPermissionsResource, {
    params: {},
    defaultValue: [],
    map: cache => cache,
  });
};

export const useProductPermissions = (productId: Nullable<string>) => {
  return useRead(productPermissionsResource, {
    params: productId ? { productId } : null,
    defaultValue: null,
    map: (cache, params) => cache[params.productId] ?? null,
  });
};

export const useProductExternalRequestPatterns = (productId: Nullable<string>, modality?: PermissionModality) => {
  const { data, pending } = useProductPermissions(productId);
  return { data: permissionsService.getExternalRequestPermissions(data, modality), pending };
};

// Every permission rolled up across all products (grant counts + per-app status).
export const useAggregatedPermissions = () => {
  const { data: all, pending } = useAllProductPermissions();
  const data = useMemo(() => permissionsService.aggregatePermissions(all), [all]);
  return { data, pending };
};

// A single permission rolled up across all products, or null for an unknown id.
export const useAggregatedPermission = (permissionId: Nullable<string>) => {
  const { data: all, pending } = useAllProductPermissions();
  const data = useMemo(
    () => (permissionId ? permissionsService.aggregatePermission(permissionId, all) : null),
    [permissionId, all],
  );
  return { data, pending };
};
