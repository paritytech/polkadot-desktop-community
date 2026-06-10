import { describe, expect, it, vi } from 'vitest';

import { createNotificationsManager } from './NotificationsManager';
import { createClickRouter } from './clickRouter';
import { type Scheduler, type SchedulerClickEvent, type SchedulerFireEvent } from './scheduler';
import { type NotificationStore } from './store';
import { type QueueEntry, HOST_QUEUE_CAPACITY } from './types';

type FakeStoreState = { entries: QueueEntry[]; nextHostId: number; counters: Record<string, number> };

function makeStore(): NotificationStore & { _state: FakeStoreState } {
  const state: FakeStoreState = { entries: [], nextHostId: 1, counters: {} };

  return {
    _state: state,
    listPending: () => state.entries.slice(),
    pendingCount: () => state.entries.length,
    add: input => {
      const hostId = state.nextHostId++;
      const perProductId = (state.counters[input.productId] ?? 0) + 1;
      state.counters[input.productId] = perProductId;
      const entry: QueueEntry = { ...input, hostId, perProductId };
      state.entries.push(entry);
      return entry;
    },
    allocateIds: productId => {
      const hostId = state.nextHostId++;
      const perProductId = (state.counters[productId] ?? 0) + 1;
      state.counters[productId] = perProductId;
      return { hostId, perProductId };
    },
    removeByHostId: hostId => {
      const idx = state.entries.findIndex(e => e.hostId === hostId);
      if (idx === -1) return null;
      const [removed] = state.entries.splice(idx, 1);
      return removed ?? null;
    },
    findByPerProductId: (productId, perProductId) =>
      state.entries.find(e => e.productId === productId && e.perProductId === perProductId) ?? null,
    removeForProduct: productId => {
      const removed: QueueEntry[] = [];
      state.entries = state.entries.filter(e => {
        if (e.productId === productId) {
          removed.push(e);
          return false;
        }
        return true;
      });
      return removed;
    },
    removeForUninstalled: installed => {
      const removed: QueueEntry[] = [];
      state.entries = state.entries.filter(e => {
        if (!installed.has(e.productId)) {
          removed.push(e);
          return false;
        }
        return true;
      });
      return removed;
    },
    clearAll: () => {
      state.entries = [];
      state.nextHostId = 1;
      state.counters = {};
    },
  };
}

function makeScheduler() {
  const fireListeners = new Set<(e: SchedulerFireEvent) => void>();
  const clickListeners = new Set<(e: SchedulerClickEvent) => void>();
  const scheduled = new Map<number, QueueEntry>();

  const scheduler: Scheduler = {
    schedule: vi.fn((entry: QueueEntry) => {
      scheduled.set(entry.hostId, entry);
      return Promise.resolve();
    }),
    cancel: vi.fn((hostId: number) => {
      scheduled.delete(hostId);
      return Promise.resolve();
    }),
    cancelAll: vi.fn(() => {
      scheduled.clear();
      return Promise.resolve();
    }),
    onFire: listener => {
      fireListeners.add(listener);
      return () => fireListeners.delete(listener);
    },
    onClick: listener => {
      clickListeners.add(listener);
      return () => clickListeners.delete(listener);
    },
    dispose: () => undefined,
  };

  return {
    scheduler,
    scheduled,
    emitFire: (hostId: number) => {
      for (const listener of fireListeners) listener({ hostId });
    },
    emitClick: (hostId: number) => {
      for (const listener of clickListeners) listener({ hostId });
    },
  };
}

describe('NotificationsManager.schedule', () => {
  it('returns a per-product id and forwards to the scheduler', async () => {
    const store = makeStore();
    const sched = makeScheduler();
    const router = createClickRouter();
    const manager = createNotificationsManager({ store, scheduler: sched.scheduler, clickRouter: router });

    const result = await manager.schedule({
      productId: 'app',
      title: 'T',
      text: 'B',
      deeplink: null,
      scheduledAt: Date.now() + 1000,
    });

    expect(result).toEqual({ ok: true, id: 1 });
    expect(sched.scheduler.schedule).toHaveBeenCalledTimes(1);
    expect(sched.scheduled.size).toBe(1);
  });

  it('allocates monotonic per-product ids per product', async () => {
    const store = makeStore();
    const sched = makeScheduler();
    const manager = createNotificationsManager({ store, scheduler: sched.scheduler, clickRouter: createClickRouter() });

    const r1 = await manager.schedule({
      productId: 'a',
      title: 't',
      text: 'b',
      deeplink: null,
      scheduledAt: Date.now() + 1 * 1000,
    });
    const r2 = await manager.schedule({
      productId: 'a',
      title: 't',
      text: 'b',
      deeplink: null,
      scheduledAt: Date.now() + 2 * 1000,
    });
    const r3 = await manager.schedule({
      productId: 'b',
      title: 't',
      text: 'b',
      deeplink: null,
      scheduledAt: Date.now() + 3 * 1000,
    });

    expect(r1).toEqual({ ok: true, id: 1 });
    expect(r2).toEqual({ ok: true, id: 2 });
    expect(r3).toEqual({ ok: true, id: 1 });
  });

  it('returns ScheduleLimitReached at capacity', async () => {
    const store = makeStore();
    const sched = makeScheduler();
    const manager = createNotificationsManager({ store, scheduler: sched.scheduler, clickRouter: createClickRouter() });

    for (let i = 0; i < HOST_QUEUE_CAPACITY; i++) {
      await manager.schedule({ productId: 'a', title: 't', text: 'b', deeplink: null, scheduledAt: Date.now() + (i + 1) * 1000 });
    }
    const last = await manager.schedule({
      productId: 'a',
      title: 't',
      text: 'b',
      deeplink: null,
      scheduledAt: Date.now() + 99 * 1000,
    });

    expect(last).toEqual({ ok: false, error: 'ScheduleLimitReached' });
  });

  it('rolls back the store entry when the scheduler throws', async () => {
    const store = makeStore();
    const sched = makeScheduler();
    sched.scheduler.schedule = vi.fn(() => Promise.reject(new Error('boom')));

    const manager = createNotificationsManager({ store, scheduler: sched.scheduler, clickRouter: createClickRouter() });

    const result = await manager.schedule({
      productId: 'a',
      title: 't',
      text: 'b',
      deeplink: null,
      scheduledAt: Date.now() + 1 * 1000,
    });
    expect(result).toEqual({ ok: false, error: 'Unknown', reason: 'boom' });
    expect(store.pendingCount()).toBe(0);
  });
});

describe('NotificationsManager.cancel', () => {
  it('removes the entry and cancels the scheduler', async () => {
    const store = makeStore();
    const sched = makeScheduler();
    const manager = createNotificationsManager({ store, scheduler: sched.scheduler, clickRouter: createClickRouter() });

    const result = await manager.schedule({
      productId: 'a',
      title: 't',
      text: 'b',
      deeplink: null,
      scheduledAt: Date.now() + 1 * 1000,
    });
    if (!result.ok) throw new Error('expected schedule to succeed');
    await manager.cancel('a', result.id);

    expect(store.pendingCount()).toBe(0);
    expect(sched.scheduled.size).toBe(0);
  });

  it('is idempotent for unknown ids', async () => {
    const store = makeStore();
    const sched = makeScheduler();
    const manager = createNotificationsManager({ store, scheduler: sched.scheduler, clickRouter: createClickRouter() });

    await expect(manager.cancel('missing', 999)).resolves.toBeUndefined();
    expect(sched.scheduler.cancel).not.toHaveBeenCalled();
  });

  it('is idempotent across products — cancelling a foreign product id is a no-op', async () => {
    const store = makeStore();
    const sched = makeScheduler();
    const manager = createNotificationsManager({ store, scheduler: sched.scheduler, clickRouter: createClickRouter() });

    await manager.schedule({ productId: 'a', title: 't', text: 'b', deeplink: null, scheduledAt: Date.now() + 1 * 1000 });
    await manager.cancel('b', 1);

    expect(store.pendingCount()).toBe(1);
  });
});

describe('NotificationsManager uninstall flow', () => {
  it('cancelAllForProduct removes every pending entry for that product', async () => {
    const store = makeStore();
    const sched = makeScheduler();
    const manager = createNotificationsManager({ store, scheduler: sched.scheduler, clickRouter: createClickRouter() });

    await manager.schedule({ productId: 'a', title: 't', text: 'b', deeplink: null, scheduledAt: Date.now() + 1 * 1000 });
    await manager.schedule({ productId: 'a', title: 't', text: 'b', deeplink: null, scheduledAt: Date.now() + 2 * 1000 });
    await manager.schedule({ productId: 'b', title: 't', text: 'b', deeplink: null, scheduledAt: Date.now() + 3 * 1000 });

    await manager.cancelAllForProduct('a');

    expect(store.pendingCount()).toBe(1);
    expect(store.listPending()[0]?.productId).toBe('b');
  });

  it('reconcileInstalled drops entries for products no longer installed', async () => {
    const store = makeStore();
    const sched = makeScheduler();
    const manager = createNotificationsManager({ store, scheduler: sched.scheduler, clickRouter: createClickRouter() });

    await manager.schedule({ productId: 'a', title: 't', text: 'b', deeplink: null, scheduledAt: Date.now() + 1 * 1000 });
    await manager.schedule({ productId: 'b', title: 't', text: 'b', deeplink: null, scheduledAt: Date.now() + 2 * 1000 });

    await manager.reconcileInstalled(['a']);

    expect(store.pendingCount()).toBe(1);
    expect(store.listPending()[0]?.productId).toBe('a');
  });
});

describe('NotificationsManager click routing', () => {
  it('emits a NotificationActivatedEvent through the click router on scheduler click', async () => {
    const store = makeStore();
    const sched = makeScheduler();
    const router = createClickRouter();
    const events: { productId: string; deeplink: string | null }[] = [];
    router.subscribe(event => events.push(event));

    const manager = createNotificationsManager({ store, scheduler: sched.scheduler, clickRouter: router });
    await manager.schedule({ productId: 'app', title: 't', text: 'b', deeplink: '/foo', scheduledAt: Date.now() + 1 * 1000 });
    // hostId is allocated by the fake store starting from 1. In practice the
    // scheduler always emits Fire before Click — replicate that ordering so
    // the test exercises the real lifecycle.
    sched.emitFire(1);
    sched.emitClick(1);

    expect(events).toEqual([{ productId: 'app', deeplink: '/foo' }]);
  });

  it('does not emit when scheduler clicks with an unknown hostId', () => {
    const store = makeStore();
    const sched = makeScheduler();
    const router = createClickRouter();
    const onActivate = vi.fn();
    router.subscribe(onActivate);

    createNotificationsManager({ store, scheduler: sched.scheduler, clickRouter: router });
    sched.emitClick(999);

    expect(onActivate).not.toHaveBeenCalled();
  });
});

describe('NotificationsManager.rehydrate', () => {
  it('re-arms persisted entries against the scheduler', async () => {
    const store = makeStore();
    store._state.entries.push({
      hostId: 42,
      productId: 'a',
      perProductId: 1,
      title: 't',
      text: 'b',
      deeplink: null,
      scheduledAt: Date.now() + 1 * 1000,
    });
    const sched = makeScheduler();
    const manager = createNotificationsManager({ store, scheduler: sched.scheduler, clickRouter: createClickRouter() });

    await manager.rehydrate();

    expect(sched.scheduler.cancel).toHaveBeenCalledWith(42);
    expect(sched.scheduler.schedule).toHaveBeenCalledTimes(1);
  });

  it('routes clicks correctly for rehydrated entries', async () => {
    const store = makeStore();
    store._state.entries.push({
      hostId: 5,
      productId: 'app',
      perProductId: 1,
      title: 't',
      text: 'b',
      deeplink: '/bar',
      scheduledAt: Date.now() + 1 * 1000,
    });
    const sched = makeScheduler();
    const router = createClickRouter();
    const events: { productId: string; deeplink: string | null }[] = [];
    router.subscribe(event => events.push(event));

    const manager = createNotificationsManager({ store, scheduler: sched.scheduler, clickRouter: router });
    await manager.rehydrate();
    sched.emitFire(5);
    sched.emitClick(5);

    expect(events).toEqual([{ productId: 'app', deeplink: '/bar' }]);
  });
});
