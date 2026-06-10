import { useAction, useRead } from '@/shared/hooks';

import { allAliasPermissionsResource, removeAliasPermission, setAliasPermission } from './resource';

export const useAllAliasPermissions = () => {
  return useRead(allAliasPermissionsResource, {
    params: {},
    defaultValue: [],
    map: cache => cache,
  });
};

export const useSetAliasPermission = () => {
  return useAction(setAliasPermission);
};

export const useRemoveAliasPermission = () => {
  return useAction(removeAliasPermission);
};
