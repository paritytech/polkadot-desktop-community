import { describe, expect, it, vi } from 'vitest';

import { createClickRouter } from './clickRouter';

describe('clickRouter', () => {
  it('delivers events to a subscribed listener', () => {
    const router = createClickRouter();
    const listener = vi.fn();
    router.subscribe(listener);

    router.emit({ productId: 'p1', deeplink: '/x' });

    expect(listener).toHaveBeenCalledWith({ productId: 'p1', deeplink: '/x' });
  });

  it('buffers events while no listener is subscribed and drains on subscribe', () => {
    const router = createClickRouter();
    router.emit({ productId: 'p1', deeplink: null });
    router.emit({ productId: 'p2', deeplink: '/y' });
    expect(router.pendingCount()).toBe(2);

    const listener = vi.fn();
    router.subscribe(listener);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, { productId: 'p1', deeplink: null });
    expect(listener).toHaveBeenNthCalledWith(2, { productId: 'p2', deeplink: '/y' });
    expect(router.pendingCount()).toBe(0);
  });

  it('does not redeliver drained events to a second subscriber', () => {
    const router = createClickRouter();
    router.emit({ productId: 'p1', deeplink: null });

    const first = vi.fn();
    router.subscribe(first);
    expect(first).toHaveBeenCalledTimes(1);

    const second = vi.fn();
    router.subscribe(second);
    expect(second).not.toHaveBeenCalled();
  });

  it('unsubscribe removes the listener', () => {
    const router = createClickRouter();
    const listener = vi.fn();
    const off = router.subscribe(listener);
    off();

    router.emit({ productId: 'p1', deeplink: null });
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not throw when a listener throws', () => {
    const router = createClickRouter();
    router.subscribe(() => {
      throw new Error('boom');
    });
    expect(() => router.emit({ productId: 'p1', deeplink: null })).not.toThrow();
  });
});
