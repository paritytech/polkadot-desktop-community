import { type ProductPermissionsRow, appDatabase, database, streamTable } from '@/shared/database';

// Product permission grants, bound from the unified database. The `stream$`
// shape matches the old createDexieStorage surface so resource.ts is unchanged
// except for read reconstruction.
export const productPermissionsDatabase = {
  table: database.productPermissions,
  stream$<T>(read: (table: typeof database.productPermissions) => Promise<T>) {
    return streamTable<ProductPermissionsRow, T>(database.productPermissions, read);
  },
  // Run a read-modify-write inside a single `rw` transaction so concurrent
  // permission mutations for the same product can't clobber each other. IndexedDB
  // serializes overlapping `rw` transactions on the same store, so the get-then-put
  // is atomic relative to any other mutate — a device-permission write and a remote
  // batch landing together both observe and extend the same committed row.
  transact<T>(run: (table: typeof database.productPermissions) => Promise<T>): Promise<T> {
    return appDatabase.transaction('rw', database.productPermissions, () => run(database.productPermissions));
  },
};
