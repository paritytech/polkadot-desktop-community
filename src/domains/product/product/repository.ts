import { ResultAsync } from 'neverthrow';
import { type Observable } from 'rxjs';

import { type ProductRow, database, streamTable } from '@/shared/database';
import { toError } from '@/shared/utils';

import { type ProductExecutables } from './manifest/types';
import { type Product } from './types';

// Persisted shape of a committed Product. Existence of the row IS the
// commitment (Flow B). `pinned` is the freeze-the-version flag set by the
// user via the offline-access UI — when true, `reconcileUnpinnedProducts`
// skips the row (no re-resolve) and `executableArchiveResource` fetches the
// frozen contenthashes already stored on the executables.
export type PersistedProduct = Product & {
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
};

const table = database.products;

// ProductRow stores executables in a decoupled, all-optional shape with `kind`
// as a plain string. Re-tag each present executable's `kind` from its own key
// and reconstruct the domain ProductExecutables. The single cast is the
// storage-boundary reconstruction (row carries every executable field; casting
// the rebuilt executables object from the all-optional row shape back to
// ProductExecutables is valid because every field is present).
function rowToPersisted(row: ProductRow): PersistedProduct {
  const rebuilt = {
    ...(row.executables.app && { app: { ...row.executables.app, kind: 'app' } }),
    ...(row.executables.widget && { widget: { ...row.executables.widget, kind: 'widget' } }),
    ...(row.executables.worker && { worker: { ...row.executables.worker, kind: 'worker' } }),
  };
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- storage-boundary reconstruction: row carries all executable fields; kind is re-tagged from its own key
  const executables = rebuilt as ProductExecutables;
  return { ...row, executables };
}

export const productDb = {
  getAll(): ResultAsync<PersistedProduct[], Error> {
    return ResultAsync.fromPromise(
      table.toArray().then(rows => rows.map(rowToPersisted)),
      toError,
    );
  },

  getByBaseName(baseName: string): ResultAsync<PersistedProduct | null, Error> {
    return ResultAsync.fromPromise(
      table.get(baseName).then(r => (r ? rowToPersisted(r) : null)),
      toError,
    );
  },

  createAll(products: PersistedProduct[]): ResultAsync<PersistedProduct[], Error> {
    return ResultAsync.fromPromise(
      table.bulkAdd(products).then(() => products),
      toError,
    );
  },

  update(baseName: string, changes: Partial<PersistedProduct>): ResultAsync<string, Error> {
    return ResultAsync.fromPromise(
      table.update(baseName, changes).then(updated => {
        if (updated) return baseName;
        throw new Error(`Product with baseName ${baseName} not found`);
      }),
      toError,
    );
  },

  // Insert-or-update preserving row history: `createdAt` survives a re-resolve,
  // `updatedAt` is bumped, `pinned` is set explicitly by the caller. Read + write
  // run in one transaction so concurrent upserts can't clobber each other's metadata.
  upsert(product: Product, options: { pinned: boolean }): ResultAsync<PersistedProduct, Error> {
    return ResultAsync.fromPromise(
      table.db.transaction('rw', table, async () => {
        const now = Date.now();
        const existing = (await table.get(product.baseName)) ?? null;
        const record: PersistedProduct = {
          ...product,
          pinned: options.pinned,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        await table.put(record);
        return record;
      }),
      toError,
    );
  },

  delete(baseName: string): ResultAsync<void, Error> {
    return ResultAsync.fromPromise(table.delete(baseName), toError);
  },

  subscribeToAll(): Observable<PersistedProduct[]> {
    return streamTable(table, t => t.toArray().then(rows => rows.map(rowToPersisted)));
  },
};
