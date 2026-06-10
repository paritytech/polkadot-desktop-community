import { type Observable } from 'rxjs';

import { type ProductExecutableCacheRow, database, streamTable } from '@/shared/database';
import { type HexString } from '@/shared/types';
import { type ExecutableKind } from '../manifest/constants';

import { type ExecutableCacheEntry, type ExecutableCacheStatus } from './types';

const table = database.productExecutableCache;

function keyOf(baseName: string, kind: ExecutableKind): string {
  return `${baseName}#${kind}`;
}

// Re-narrow string fields back to their union types at the storage boundary.
// The row's `kind` and `status` columns are persisted as `string` (shared/database
// may not import domain unions); we cast them back here — this is the canonical
// reconstruction point, matching the `rowToPersisted` pattern in product/repository.ts.
function rowToEntry(row: ProductExecutableCacheRow): ExecutableCacheEntry {
  return {
    baseName: row.baseName,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- storage-boundary reconstruction: kind is written by this repository as a valid ExecutableKind; cast back is safe
    kind: row.kind as ExecutableKind,
    domain: row.domain,
    contenthash: row.contenthash,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- storage-boundary reconstruction: status is written by this repository as a valid ExecutableCacheStatus; cast back is safe
    status: row.status as ExecutableCacheStatus,
    sizeBytes: row.sizeBytes,
    updatedAt: row.updatedAt,
  };
}

async function getByBaseName(baseName: string): Promise<ExecutableCacheEntry[]> {
  const rows = await table.where('baseName').equals(baseName).toArray();
  return rows.map(rowToEntry);
}

async function setStatus(
  baseName: string,
  kind: ExecutableKind,
  domain: string,
  contenthash: HexString,
  status: ExecutableCacheStatus,
  sizeBytes = 0,
): Promise<void> {
  await table.put({
    key: keyOf(baseName, kind),
    baseName,
    kind,
    domain,
    contenthash,
    status,
    sizeBytes,
    updatedAt: Date.now(),
  });
}

async function deleteByBaseName(baseName: string): Promise<void> {
  await table.where('baseName').equals(baseName).delete();
}

function subscribeToAll(): Observable<ExecutableCacheEntry[]> {
  return streamTable(table, t => t.toArray().then(rows => rows.map(rowToEntry)));
}

export const executableCacheRepository = {
  getByBaseName,
  setStatus,
  deleteByBaseName,
  subscribeToAll,
};
