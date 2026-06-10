import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createScheduler } from './scheduler';
import { type QueueEntry } from './types';

function makeEntry(overrides: Partial<QueueEntry> = {}): QueueEntry {
  return {
    hostId: 1,
    productId: 'p',
    perProductId: 1,
    title: 'title',
    text: 'text',
    deeplink: null,
    scheduledAt: 0,
    ...overrides,
  };
}

describe('scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-12T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires after the scheduled delay and emits onFire', async () => {
    const fire = vi.fn(() => ({ onClick: vi.fn() }));
    const onFire = vi.fn();
    const scheduler = createScheduler({ fire });
    scheduler.onFire(onFire);

    const fireAt = Date.now() + 1000;
    await scheduler.schedule(makeEntry({ hostId: 7, scheduledAt: fireAt }));

    expect(fire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);

    expect(fire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenCalledWith({ hostId: 7 });
  });

  it('past timestamps fire on next tick', async () => {
    const fire = vi.fn(() => ({ onClick: vi.fn() }));
    const onFire = vi.fn();
    const scheduler = createScheduler({ fire });
    scheduler.onFire(onFire);

    await scheduler.schedule(makeEntry({ hostId: 3, scheduledAt: Date.now() - 5000 }));
    vi.advanceTimersByTime(0);

    expect(fire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenCalledWith({ hostId: 3 });
  });

  it('cancel before fire prevents the fire callback', async () => {
    const fire = vi.fn(() => ({ onClick: vi.fn() }));
    const scheduler = createScheduler({ fire });

    await scheduler.schedule(makeEntry({ hostId: 9, scheduledAt: Date.now() + 100 }));
    await scheduler.cancel(9);
    vi.advanceTimersByTime(100);

    expect(fire).not.toHaveBeenCalled();
  });

  it('re-scheduling the same hostId replaces the prior timer', async () => {
    const fire = vi.fn(() => ({ onClick: vi.fn() }));
    const scheduler = createScheduler({ fire });

    await scheduler.schedule(makeEntry({ hostId: 1, scheduledAt: Date.now() + 100 }));
    await scheduler.schedule(makeEntry({ hostId: 1, scheduledAt: Date.now() + 500 }));

    vi.advanceTimersByTime(100);
    expect(fire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('emits onClick when the fire handle reports a click', async () => {
    let clickCallback: VoidFunction = () => undefined;
    const fire = vi.fn(() => ({
      onClick: (cb: VoidFunction) => {
        clickCallback = cb;
      },
    }));
    const onClick = vi.fn();
    const scheduler = createScheduler({ fire });
    scheduler.onClick(onClick);

    await scheduler.schedule(makeEntry({ hostId: 4, scheduledAt: Date.now() }));
    vi.advanceTimersByTime(0);
    clickCallback();

    expect(onClick).toHaveBeenCalledWith({ hostId: 4 });
  });

  it('cancelAll clears all pending timers', async () => {
    const fire = vi.fn(() => ({ onClick: vi.fn() }));
    const scheduler = createScheduler({ fire });

    await scheduler.schedule(makeEntry({ hostId: 1, scheduledAt: Date.now() + 100 }));
    await scheduler.schedule(makeEntry({ hostId: 2, scheduledAt: Date.now() + 200 }));
    await scheduler.cancelAll();
    vi.advanceTimersByTime(500);

    expect(fire).not.toHaveBeenCalled();
  });
});
