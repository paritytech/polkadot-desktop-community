import { createDexieDatabase } from '@/shared/dexie';
import { createAsyncTaskPool } from '@/shared/utils';

import { type KnownUserDevice } from './types';

export const deviceSyncDatabase = createDexieDatabase<{
  knownUserDevices: KnownUserDevice;
}>({
  name: 'device-sync',
  version: 1,
  schema: {
    knownUserDevices: 'statementAccountId, status',
  },
});

// Per-row write serialization: at most one read-modify-write in flight per
// statementAccountId (the pool name), so concurrent callers can't each snapshot
// the same row and clobber one another's fields — e.g. a reset's
// `setLastOfferId(null)` racing the respawn's `setLastOfferId(newId)`, or an
// offerId write racing a checkpoint advance. Writes for one key run in call
// order; the last write of a field wins.
//
// `clearAll` wipes every row, so it must additionally be mutually exclusive with
// ALL per-row writes: if a `.clear()` landed between a row write's `get` and its
// `put`, the put would re-insert the row that was just cleared — a zombie that
// survives logout/re-pair (the previous user's peer bleeding into the next
// session). `clearBarrier` enforces that: a clear waits for the per-row writes
// already in flight and blocks new ones until it finishes, while per-key
// parallelism is preserved for the common (non-clear) path.
const rowWritePool = createAsyncTaskPool({ poolSize: 1 });
let clearBarrier: Promise<unknown> = Promise.resolve();
const inFlightRowWrites = new Set<Promise<unknown>>();

const withRowLock = <T>(statementAccountId: string, fn: () => Promise<T>): Promise<T> => {
  const run = clearBarrier.then(() => rowWritePool.call(fn, { pool: statementAccountId }));
  inFlightRowWrites.add(run);
  void run.catch(() => {}).finally(() => inFlightRowWrites.delete(run));

  return run;
};

const clearAllRows = (): Promise<void> => {
  // Snapshot in-flight writes SYNCHRONOUSLY: only writes issued before this
  // clear must be drained. Writes issued afterwards chain off the new barrier
  // (this clear) and run once it completes, so they are never awaited here —
  // awaiting them would deadlock (clear waits for write, write waits for clear).
  const drained = [...inFlightRowWrites];
  const clear = clearBarrier.then(async () => {
    await Promise.allSettled(drained);
    await deviceSyncDatabase.knownUserDevices.clear();
  });
  clearBarrier = clear.catch(() => {});

  return clear;
};

export const deviceSyncRepository = {
  get: (statementAccountId: string): Promise<KnownUserDevice | undefined> =>
    deviceSyncDatabase.knownUserDevices.get(statementAccountId),

  upsert: (device: KnownUserDevice): Promise<void> =>
    withRowLock(device.statementAccountId, async () => {
      await deviceSyncDatabase.knownUserDevices.put(device);
    }),

  list: (): Promise<KnownUserDevice[]> => deviceSyncDatabase.knownUserDevices.toArray(),

  listActivePeers: async (selfStatementAccountId: string): Promise<KnownUserDevice[]> => {
    const all = await deviceSyncDatabase.knownUserDevices.toArray();
    return all.filter(d => d.status === 'active' && d.statementAccountId !== selfStatementAccountId);
  },

  remove: (statementAccountId: string): Promise<void> =>
    withRowLock(statementAccountId, async () => {
      await deviceSyncDatabase.knownUserDevices.delete(statementAccountId);
    }),

  advanceOutgoingUpdateTime: (statementAccountId: string, timePoint: number): Promise<void> =>
    withRowLock(statementAccountId, async () => {
      const existing = await deviceSyncDatabase.knownUserDevices.get(statementAccountId);
      if (!existing) return;
      if (timePoint <= existing.outgoingUpdateTime) return;
      await deviceSyncDatabase.knownUserDevices.put({ ...existing, outgoingUpdateTime: timePoint });
    }),

  /**
   * Refresh roster metadata (encryption key, lastUpdate) for a device PApp has
   * (re)announced, WITHOUT touching runtime state: a re-announced device keeps
   * its persisted `lastOfferId` (so restart recovery still works) and its
   * `outgoingUpdateTime` checkpoint (so we don't re-ship already-acked updates).
   * Inserts a fresh row (checkpoint 0, no offerId) for an unknown device.
   */
  upsertFromRoster: (params: { statementAccountId: string; encryptionPublicKey: string; lastUpdate: number }): Promise<void> =>
    withRowLock(params.statementAccountId, async () => {
      const existing = await deviceSyncDatabase.knownUserDevices.get(params.statementAccountId);
      await deviceSyncDatabase.knownUserDevices.put({
        ...existing,
        statementAccountId: params.statementAccountId,
        encryptionPublicKey: params.encryptionPublicKey,
        status: 'active',
        lastUpdate: params.lastUpdate,
        outgoingUpdateTime: existing?.outgoingUpdateTime ?? 0,
      });
    }),

  /**
   * Write/clear the persisted device-sync signaling offerId for one peer.
   * Pass `null` to clear (used when the local peer wins a Reconnected and
   * disposes the matching attempt — see the orchestrator). Idempotent: a
   * no-op when the row doesn't exist yet (the peer isn't tracked).
   */
  setLastOfferId: (statementAccountId: string, offerId: string | null): Promise<void> =>
    withRowLock(statementAccountId, async () => {
      const existing = await deviceSyncDatabase.knownUserDevices.get(statementAccountId);
      if (!existing) return;
      if (existing.lastOfferId === (offerId ?? undefined)) return;
      await deviceSyncDatabase.knownUserDevices.put({
        ...existing,
        lastOfferId: offerId ?? undefined,
      });
    }),

  /** Called on handshake re-pair — PApp's device keys rotate so cached siblings become zombies. */
  clearAll: clearAllRows,
};
