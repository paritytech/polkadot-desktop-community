import { type Observable, map } from 'rxjs';

import { database, streamTable } from '@/shared/database';

// Binary key/value storage for the product sandbox, one row per key. The key arrives
// already namespaced by the core, so nothing here knows which product owns it. The
// point reads and writes are imperative — the sandbox SDK reads/writes blobs on demand —
// so this is a plain repository surface, not a resource or use case. `watchEntry` is the
// one live read: the core subscribes to a key and the table's own writes are the change
// signal, the same liveQuery mechanism `coreStorageRepository` uses for its slot index.
async function readEntry(key: string): Promise<Uint8Array | undefined> {
  return (await database.productStorage.get(key))?.value;
}

async function writeEntry(key: string, value: Uint8Array): Promise<void> {
  await database.productStorage.put({ key, value });
}

async function clearEntry(key: string): Promise<void> {
  await database.productStorage.delete(key);
}

async function clearByPrefix(prefix: string): Promise<void> {
  await database.productStorage.where('key').startsWith(prefix).delete();
}

async function listKeys(): Promise<string[]> {
  return database.productStorage.toCollection().primaryKeys();
}

function watchEntry(key: string): Observable<Uint8Array | undefined> {
  return streamTable(database.productStorage, table => table.get(key)).pipe(map(row => row?.value));
}

export const productLocalStorageRepository = {
  readEntry,
  writeEntry,
  clearEntry,
  clearByPrefix,
  listKeys,
  watchEntry,
};
