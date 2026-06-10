import { type AliasPermissionRow, database, streamTable } from '@/shared/database';

export const aliasPermissionsDatabase = {
  table: database.aliasPermissions,
  stream$<T>(read: (table: typeof database.aliasPermissions) => Promise<T>) {
    return streamTable<AliasPermissionRow, T>(database.aliasPermissions, read);
  },
};
