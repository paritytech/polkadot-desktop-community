import { default as Store } from 'electron-store';

import { type QueueEntry } from './types';

type Persisted = {
  entries: QueueEntry[];
  nextHostId: number;
  // perProductId counters keyed by productId
  perProductCounters: Record<string, number>;
};

const DEFAULTS: Persisted = {
  entries: [],
  nextHostId: 1,
  perProductCounters: {},
};

export type NotificationStore = {
  listPending(): QueueEntry[];
  pendingCount(): number;
  add(entry: Omit<QueueEntry, 'hostId' | 'perProductId'>): QueueEntry;
  // Bumps id counters without persisting an entry. Used for immediate-fire
  // notifications that don't need to survive process restarts but still need
  // a stable, non-colliding NotificationId returned to the product.
  allocateIds(productId: string): { hostId: number; perProductId: number };
  removeByHostId(hostId: number): QueueEntry | null;
  findByPerProductId(productId: string, perProductId: number): QueueEntry | null;
  removeForProduct(productId: string): QueueEntry[];
  removeForUninstalled(installedProductIds: ReadonlySet<string>): QueueEntry[];
  clearAll(): void;
};

export function createNotificationStore(opts?: { name?: string; cwd?: string }): NotificationStore {
  const backing = new Store<Persisted>({
    name: opts?.name ?? 'scheduled-notifications',
    cwd: opts?.cwd,
    defaults: DEFAULTS,
  });

  function read(): Persisted {
    return {
      entries: backing.get('entries'),
      nextHostId: backing.get('nextHostId'),
      perProductCounters: backing.get('perProductCounters'),
    };
  }

  function write(state: Persisted): void {
    backing.set('entries', state.entries);
    backing.set('nextHostId', state.nextHostId);
    backing.set('perProductCounters', state.perProductCounters);
  }

  function listPending(): QueueEntry[] {
    return read().entries.slice();
  }

  function pendingCount(): number {
    return read().entries.length;
  }

  function add(entry: Omit<QueueEntry, 'hostId' | 'perProductId'>): QueueEntry {
    const state = read();
    const hostId = state.nextHostId;
    const perProductId = (state.perProductCounters[entry.productId] ?? 0) + 1;

    const full: QueueEntry = { ...entry, hostId, perProductId };
    state.entries.push(full);
    state.nextHostId = hostId + 1;
    state.perProductCounters[entry.productId] = perProductId;

    write(state);
    return full;
  }

  function allocateIds(productId: string): { hostId: number; perProductId: number } {
    const state = read();
    const hostId = state.nextHostId;
    const perProductId = (state.perProductCounters[productId] ?? 0) + 1;
    state.nextHostId = hostId + 1;
    state.perProductCounters[productId] = perProductId;
    write(state);
    return { hostId, perProductId };
  }

  function removeByHostId(hostId: number): QueueEntry | null {
    const state = read();
    const idx = state.entries.findIndex(e => e.hostId === hostId);
    if (idx === -1) return null;

    const [removed] = state.entries.splice(idx, 1);
    write(state);
    return removed ?? null;
  }

  function findByPerProductId(productId: string, perProductId: number): QueueEntry | null {
    return read().entries.find(e => e.productId === productId && e.perProductId === perProductId) ?? null;
  }

  function removeForProduct(productId: string): QueueEntry[] {
    const state = read();
    const removed: QueueEntry[] = [];
    const remaining: QueueEntry[] = [];
    for (const entry of state.entries) {
      if (entry.productId === productId) {
        removed.push(entry);
      } else {
        remaining.push(entry);
      }
    }
    if (removed.length === 0) return removed;

    state.entries = remaining;
    write(state);
    return removed;
  }

  function removeForUninstalled(installedProductIds: ReadonlySet<string>): QueueEntry[] {
    const state = read();
    const removed: QueueEntry[] = [];
    const remaining: QueueEntry[] = [];
    for (const entry of state.entries) {
      if (installedProductIds.has(entry.productId)) {
        remaining.push(entry);
      } else {
        removed.push(entry);
      }
    }
    if (removed.length === 0) return removed;

    state.entries = remaining;
    write(state);
    return removed;
  }

  function clearAll(): void {
    write({ ...DEFAULTS });
  }

  return {
    listPending,
    pendingCount,
    add,
    allocateIds,
    removeByHostId,
    findByPerProductId,
    removeForProduct,
    removeForUninstalled,
    clearAll,
  };
}
