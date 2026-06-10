import { type Statement } from '@novasamatech/sdk-statement';
import { describe, expect, it, vi } from 'vitest';

import { createReconnectAwareSubscribe } from './reconnectAwareSubscribe';

type TopicFilter = { matchAll: Uint8Array[] } | { matchAny: Uint8Array[] };
type StatementsPage = { statements: Statement[]; isComplete: boolean };
type SubscribeFn = (filter: TopicFilter, cb: (page: StatementsPage) => unknown) => VoidFunction;

// Models the chain status emitter the wrapper subscribes to.
const makeStatusEmitter = () => {
  let listener: ((status: 'connected' | 'connecting' | 'disconnected') => void) | null = null;
  return {
    onStatusChanged: (cb: (status: 'connected' | 'connecting' | 'disconnected') => void) => {
      listener = cb;
      return () => {
        listener = null;
      };
    },
    emit: (status: 'connected' | 'connecting' | 'disconnected') => listener?.(status),
  };
};

describe('createReconnectAwareSubscribe', () => {
  it('forwards subscribe and unsubscribe calls to the inner subscribe', () => {
    const innerUnsub = vi.fn();
    const inner: SubscribeFn = vi.fn(() => innerUnsub);
    const status = makeStatusEmitter();

    const { subscribe } = createReconnectAwareSubscribe({ inner, onStatusChanged: status.onStatusChanged });

    const filter: TopicFilter = { matchAll: [new Uint8Array([1])] };
    const cb = vi.fn();
    const unsub = subscribe(filter, cb);

    expect(inner).toHaveBeenCalledWith(filter, cb);

    unsub();
    expect(innerUnsub).toHaveBeenCalledOnce();
  });

  it('does not re-subscribe on the first connected event (initial connection)', () => {
    const inner: SubscribeFn = vi.fn(() => () => {});
    const status = makeStatusEmitter();

    const { subscribe } = createReconnectAwareSubscribe({ inner, onStatusChanged: status.onStatusChanged });
    subscribe({ matchAll: [new Uint8Array([1])] }, vi.fn());
    expect(inner).toHaveBeenCalledTimes(1);

    status.emit('connecting');
    status.emit('connected');

    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('tears down and re-creates active subscriptions on reconnect (disconnected → connected)', () => {
    const innerUnsubs: ReturnType<typeof vi.fn>[] = [];
    const inner: SubscribeFn = vi.fn(() => {
      const u = vi.fn();
      innerUnsubs.push(u);
      return u;
    });
    const status = makeStatusEmitter();

    const { subscribe } = createReconnectAwareSubscribe({ inner, onStatusChanged: status.onStatusChanged });
    const filter: TopicFilter = { matchAll: [new Uint8Array([1])] };
    const cb = vi.fn();
    subscribe(filter, cb);

    status.emit('disconnected');
    status.emit('connecting');
    status.emit('connected');

    expect(inner).toHaveBeenCalledTimes(2);
    expect(inner).toHaveBeenLastCalledWith(filter, cb);
    expect(innerUnsubs[0]).toHaveBeenCalledOnce();
  });

  it('re-subscribes every active entry on reconnect, preserving callbacks', () => {
    const inner: SubscribeFn = vi.fn(() => () => {});
    const status = makeStatusEmitter();

    const { subscribe } = createReconnectAwareSubscribe({ inner, onStatusChanged: status.onStatusChanged });
    const filterA: TopicFilter = { matchAll: [new Uint8Array([1])] };
    const filterB: TopicFilter = { matchAny: [new Uint8Array([2]), new Uint8Array([3])] };
    const cbA = vi.fn();
    const cbB = vi.fn();
    subscribe(filterA, cbA);
    subscribe(filterB, cbB);

    status.emit('disconnected');
    status.emit('connected');

    expect(inner).toHaveBeenCalledTimes(4);
    expect(inner).toHaveBeenNthCalledWith(3, filterA, cbA);
    expect(inner).toHaveBeenNthCalledWith(4, filterB, cbB);
  });

  it('does not re-subscribe entries that were unsubscribed before reconnect', () => {
    const inner: SubscribeFn = vi.fn(() => () => {});
    const status = makeStatusEmitter();

    const { subscribe } = createReconnectAwareSubscribe({ inner, onStatusChanged: status.onStatusChanged });
    const unsubA = subscribe({ matchAll: [new Uint8Array([1])] }, vi.fn());
    subscribe({ matchAll: [new Uint8Array([2])] }, vi.fn());
    unsubA();

    status.emit('disconnected');
    status.emit('connected');

    expect(inner).toHaveBeenCalledTimes(3);
  });

  it('ignores duplicate unsubscribe calls', () => {
    const innerUnsub = vi.fn();
    const inner: SubscribeFn = vi.fn(() => innerUnsub);
    const status = makeStatusEmitter();

    const { subscribe } = createReconnectAwareSubscribe({ inner, onStatusChanged: status.onStatusChanged });
    const unsub = subscribe({ matchAll: [new Uint8Array([1])] }, vi.fn());

    unsub();
    unsub();

    expect(innerUnsub).toHaveBeenCalledOnce();
  });

  it('handles connected without intervening disconnected as a no-op', () => {
    const inner: SubscribeFn = vi.fn(() => () => {});
    const status = makeStatusEmitter();

    const { subscribe } = createReconnectAwareSubscribe({ inner, onStatusChanged: status.onStatusChanged });
    subscribe({ matchAll: [new Uint8Array([1])] }, vi.fn());

    status.emit('connected');
    status.emit('connected');
    status.emit('connecting');
    status.emit('connected');

    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('re-arms after a reconnect so a subsequent reconnect also re-subscribes', () => {
    const inner: SubscribeFn = vi.fn(() => () => {});
    const status = makeStatusEmitter();

    const { subscribe } = createReconnectAwareSubscribe({ inner, onStatusChanged: status.onStatusChanged });
    subscribe({ matchAll: [new Uint8Array([1])] }, vi.fn());

    status.emit('disconnected');
    status.emit('connected');
    expect(inner).toHaveBeenCalledTimes(2);

    status.emit('disconnected');
    status.emit('connected');
    expect(inner).toHaveBeenCalledTimes(3);
  });

  it('unsubscribing after a reconnect tears down the latest inner subscription', () => {
    const unsubs: ReturnType<typeof vi.fn>[] = [];
    const inner: SubscribeFn = vi.fn(() => {
      const u = vi.fn();
      unsubs.push(u);
      return u;
    });
    const status = makeStatusEmitter();

    const { subscribe } = createReconnectAwareSubscribe({ inner, onStatusChanged: status.onStatusChanged });
    const unsub = subscribe({ matchAll: [new Uint8Array([1])] }, vi.fn());

    status.emit('disconnected');
    status.emit('connected');

    unsub();

    expect(unsubs[0]).toHaveBeenCalledOnce();
    expect(unsubs[1]).toHaveBeenCalledOnce();
  });

  it('dispose detaches the status listener', () => {
    const inner: SubscribeFn = vi.fn(() => () => {});
    const status = makeStatusEmitter();

    const { subscribe, dispose } = createReconnectAwareSubscribe({
      inner,
      onStatusChanged: status.onStatusChanged,
    });
    subscribe({ matchAll: [new Uint8Array([1])] }, vi.fn());
    dispose();

    status.emit('disconnected');
    status.emit('connected');

    expect(inner).toHaveBeenCalledTimes(1);
  });
});
