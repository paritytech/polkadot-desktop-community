import { type QueueEntry } from './types';

export type SchedulerFireEvent = { hostId: number };
export type SchedulerClickEvent = { hostId: number };

export type Scheduler = {
  schedule(entry: QueueEntry): Promise<void>;
  cancel(hostId: number): Promise<void>;
  cancelAll(): Promise<void>;
  onFire(listener: (event: SchedulerFireEvent) => void): VoidFunction;
  onClick(listener: (event: SchedulerClickEvent) => void): VoidFunction;
  dispose(): void;
};

export type TimerHandle = ReturnType<typeof setTimeout>;

export type SchedulerDeps = {
  // Indirection so tests can drive time. Defaults to global setTimeout/clearTimeout.
  setTimer?: (cb: () => void, ms: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
  now?: () => number;
  // Side effect that actually renders the notification when its timer fires.
  fire: (entry: QueueEntry) => { onClick(listener: VoidFunction): void };
};

export function createScheduler(deps: SchedulerDeps): Scheduler {
  const setTimer = deps.setTimer ?? ((cb, ms) => globalThis.setTimeout(cb, ms));
  const clearTimer = deps.clearTimer ?? (handle => globalThis.clearTimeout(handle));
  const now = deps.now ?? (() => Date.now());

  const timers = new Map<number, TimerHandle>();
  const entries = new Map<number, QueueEntry>();
  const fireListeners = new Set<(e: SchedulerFireEvent) => void>();
  const clickListeners = new Set<(e: SchedulerClickEvent) => void>();

  function emitFire(hostId: number): void {
    for (const listener of fireListeners) {
      try {
        listener({ hostId });
      } catch (error) {
        console.warn('[notifications] onFire listener threw', error);
      }
    }
  }

  function emitClick(hostId: number): void {
    for (const listener of clickListeners) {
      try {
        listener({ hostId });
      } catch (error) {
        console.warn('[notifications] onClick listener threw', error);
      }
    }
  }

  function fireNow(entry: QueueEntry): void {
    timers.delete(entry.hostId);
    entries.delete(entry.hostId);

    let handle: ReturnType<typeof deps.fire>;
    try {
      handle = deps.fire(entry);
    } catch (error) {
      console.warn('[notifications] fire callback threw', error);
      emitFire(entry.hostId);
      return;
    }

    handle.onClick(() => emitClick(entry.hostId));
    emitFire(entry.hostId);
  }

  function schedule(entry: QueueEntry): Promise<void> {
    // Idempotent — re-scheduling the same hostId replaces the prior timer.
    const existing = timers.get(entry.hostId);
    if (existing !== undefined) clearTimer(existing);

    entries.set(entry.hostId, entry);

    const delay = Math.max(0, entry.scheduledAt - now());
    const handle = setTimer(() => fireNow(entry), delay);
    timers.set(entry.hostId, handle);
    return Promise.resolve();
  }

  function cancel(hostId: number): Promise<void> {
    const handle = timers.get(hostId);
    if (handle !== undefined) clearTimer(handle);
    timers.delete(hostId);
    entries.delete(hostId);
    return Promise.resolve();
  }

  function cancelAll(): Promise<void> {
    for (const handle of timers.values()) clearTimer(handle);
    timers.clear();
    entries.clear();
    return Promise.resolve();
  }

  function onFire(listener: (e: SchedulerFireEvent) => void): VoidFunction {
    fireListeners.add(listener);
    return () => {
      fireListeners.delete(listener);
    };
  }

  function onClick(listener: (e: SchedulerClickEvent) => void): VoidFunction {
    clickListeners.add(listener);
    return () => {
      clickListeners.delete(listener);
    };
  }

  function dispose(): void {
    for (const handle of timers.values()) clearTimer(handle);
    timers.clear();
    entries.clear();
    fireListeners.clear();
    clickListeners.clear();
  }

  return {
    schedule,
    cancel,
    cancelAll,
    onFire,
    onClick,
    dispose,
  };
}
