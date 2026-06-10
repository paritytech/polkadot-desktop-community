import { type ClickRouter } from './clickRouter';
import { type Scheduler } from './scheduler';
import { type NotificationStore } from './store';
import { type NotificationId, type QueueEntry, type ScheduleRequest, type ScheduleResult, HOST_QUEUE_CAPACITY } from './types';

export type NotificationsManagerDeps = {
  store: NotificationStore;
  scheduler: Scheduler;
  clickRouter: ClickRouter;
};

export type NotificationsManager = {
  schedule(req: ScheduleRequest): Promise<ScheduleResult>;
  cancel(productId: string, perProductId: NotificationId): Promise<void>;
  cancelAllForProduct(productId: string): Promise<void>;
  reconcileInstalled(installedProductIds: readonly string[]): Promise<void>;
  rehydrate(): Promise<void>;
  dispose(): void;
};

export function createNotificationsManager(deps: NotificationsManagerDeps): NotificationsManager {
  const { store, scheduler, clickRouter } = deps;

  // hostId → entry, kept in step with the store. Used by the scheduler's fire
  // callback (which only knows hostId) to recover productId + deeplink.
  const byHostId = new Map<number, QueueEntry>();

  function indexEntry(entry: QueueEntry): void {
    byHostId.set(entry.hostId, entry);
  }

  function dropEntry(hostId: number): QueueEntry | null {
    const entry = byHostId.get(hostId) ?? null;
    byHostId.delete(hostId);
    return entry;
  }

  const offFire = scheduler.onFire(({ hostId }) => {
    // The OS / timer fired — drop the entry from the store so it doesn't get
    // re-armed on next launch. The in-memory entry stays alive so a follow-up
    // click can still resolve productId + deeplink.
    store.removeByHostId(hostId);
  });

  const offClick = scheduler.onClick(({ hostId }) => {
    // The store entry was already removed at fire time; look up the cached
    // entry instead. If the click race-lost to a manual cancel we'll have no
    // record and silently drop the event.
    const entry = dropEntry(hostId);
    if (!entry) return;
    clickRouter.emit({ productId: entry.productId, deeplink: entry.deeplink });
  });

  async function schedule(req: ScheduleRequest): Promise<ScheduleResult> {
    const now = Date.now();

    // Immediate-fire path: skip the persisted queue (and its cap). We still
    // need stable ids so the renderer can return a NotificationId and cancel
    // is a safe no-op once it has fired.
    if (req.scheduledAt === null || req.scheduledAt <= now) {
      const { hostId, perProductId } = store.allocateIds(req.productId);
      const entry: QueueEntry = {
        hostId,
        perProductId,
        productId: req.productId,
        title: req.title,
        text: req.text,
        deeplink: req.deeplink,
        scheduledAt: now,
      };
      indexEntry(entry);

      try {
        await scheduler.schedule(entry);
      } catch (error) {
        dropEntry(entry.hostId);
        const reason = error instanceof Error ? error.message : String(error);
        return { ok: false, error: 'Unknown', reason };
      }

      return { ok: true, id: perProductId };
    }

    const scheduledAt = req.scheduledAt;

    if (store.pendingCount() >= HOST_QUEUE_CAPACITY) {
      return { ok: false, error: 'ScheduleLimitReached' };
    }

    const entry = store.add({
      productId: req.productId,
      title: req.title,
      text: req.text,
      deeplink: req.deeplink,
      scheduledAt,
    });
    indexEntry(entry);

    try {
      await scheduler.schedule(entry);
    } catch (error) {
      store.removeByHostId(entry.hostId);
      dropEntry(entry.hostId);
      const reason = error instanceof Error ? error.message : String(error);
      return { ok: false, error: 'Unknown', reason };
    }

    return { ok: true, id: entry.perProductId };
  }

  async function cancel(productId: string, perProductId: NotificationId): Promise<void> {
    const entry = store.findByPerProductId(productId, perProductId);
    if (!entry) return; // Idempotent — fired, never existed, or foreign product.

    store.removeByHostId(entry.hostId);
    dropEntry(entry.hostId);
    try {
      await scheduler.cancel(entry.hostId);
    } catch (error) {
      console.warn('[notifications] scheduler.cancel failed', { hostId: entry.hostId, error });
    }
  }

  async function cancelAllForProduct(productId: string): Promise<void> {
    const removed = store.removeForProduct(productId);
    for (const entry of removed) {
      dropEntry(entry.hostId);
      try {
        await scheduler.cancel(entry.hostId);
      } catch (error) {
        console.warn('[notifications] scheduler.cancel failed during cancelAllForProduct', {
          hostId: entry.hostId,
          error,
        });
      }
    }
  }

  async function reconcileInstalled(installedProductIds: readonly string[]): Promise<void> {
    const removed = store.removeForUninstalled(new Set(installedProductIds));
    for (const entry of removed) {
      dropEntry(entry.hostId);
      try {
        await scheduler.cancel(entry.hostId);
      } catch (error) {
        console.warn('[notifications] scheduler.cancel failed during reconcile', {
          hostId: entry.hostId,
          error,
        });
      }
    }
  }

  async function rehydrate(): Promise<void> {
    const pending = store.listPending();
    for (const entry of pending) {
      indexEntry(entry);
      try {
        // Cancel-then-schedule is idempotent against any state the underlying
        // (potentially native) scheduler may have carried over from a previous
        // process. The store remains the source of truth.
        await scheduler.cancel(entry.hostId);
        await scheduler.schedule(entry);
      } catch (error) {
        console.warn('[notifications] rehydrate failed for entry', { hostId: entry.hostId, error });
      }
    }
  }

  function dispose(): void {
    offFire();
    offClick();
    scheduler.dispose();
    byHostId.clear();
  }

  return {
    schedule,
    cancel,
    cancelAllForProduct,
    reconcileInstalled,
    rehydrate,
    dispose,
  };
}
