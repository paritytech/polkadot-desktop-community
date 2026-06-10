import { type Statement } from '@novasamatech/sdk-statement';
import { type StatementStoreAdapter } from '@novasamatech/statement-store';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SUBSCRIPTION_BUDGET, subscriptionRegistry, trackedSubscribeStatements } from './subscription-registry';

type TopicFilter = { matchAll: Uint8Array[] } | { matchAny: Uint8Array[] };
type StatementsPage = { statements: Statement[]; isComplete: boolean };

const makeAdapter = (
  subscribe?: (filter: TopicFilter, callback: (page: StatementsPage) => unknown) => () => void,
): StatementStoreAdapter => {
  const fallback = () => () => {};
  return {
    queryStatements: vi.fn(),
    submitStatement: vi.fn(),
    subscribeStatements: vi.fn(subscribe ?? fallback),
  } as unknown as StatementStoreAdapter;
};

afterEach(() => {
  subscriptionRegistry.reset();
  vi.restoreAllMocks();
});

describe('subscriptionRegistry', () => {
  it('starts with size 0', () => {
    expect(subscriptionRegistry.size()).toBe(0);
  });

  it('exposes a budget of 120 topics', () => {
    expect(SUBSCRIPTION_BUDGET).toBe(120);
  });

  it('counts a single matchAll subscription as 1 unique topic', () => {
    const adapter = makeAdapter();

    trackedSubscribeStatements(adapter, { matchAll: [new Uint8Array([1, 2, 3])] }, () => {});

    expect(subscriptionRegistry.size()).toBe(1);
  });

  it('counts a matchAny subscription with N distinct topics as N unique topics', () => {
    const adapter = makeAdapter();

    trackedSubscribeStatements(adapter, { matchAny: [new Uint8Array([1]), new Uint8Array([2])] }, () => {});

    expect(subscriptionRegistry.size()).toBe(2);
  });

  it('counts duplicate topics across calls as 1 unique', () => {
    const adapter = makeAdapter();
    const topic = new Uint8Array([7, 7, 7]);

    trackedSubscribeStatements(adapter, { matchAll: [topic] }, () => {});
    trackedSubscribeStatements(adapter, { matchAll: [topic] }, () => {});

    expect(subscriptionRegistry.size()).toBe(1);
  });

  it('decrements size when unsubscribed', () => {
    const adapter = makeAdapter();
    const topic = new Uint8Array([1]);

    const unsub = trackedSubscribeStatements(adapter, { matchAll: [topic] }, () => {});
    expect(subscriptionRegistry.size()).toBe(1);

    unsub();
    expect(subscriptionRegistry.size()).toBe(0);
  });

  it('keeps the topic counted while another subscriber still holds it', () => {
    const adapter = makeAdapter();
    const topic = new Uint8Array([9]);

    const unsubA = trackedSubscribeStatements(adapter, { matchAll: [topic] }, () => {});
    const unsubB = trackedSubscribeStatements(adapter, { matchAll: [topic] }, () => {});

    unsubA();
    expect(subscriptionRegistry.size()).toBe(1);

    unsubB();
    expect(subscriptionRegistry.size()).toBe(0);
  });

  it('forwards the underlying subscribeStatements call to the adapter', () => {
    const adapter = makeAdapter();
    const filter: TopicFilter = { matchAll: [new Uint8Array([1])] };
    const callback = vi.fn();

    trackedSubscribeStatements(adapter, filter, callback);

    expect(adapter.subscribeStatements).toHaveBeenCalledWith(filter, callback);
  });

  it('returns a function that calls the underlying unsubscribe', () => {
    const innerUnsub = vi.fn();
    const adapter = makeAdapter(() => innerUnsub);

    const unsub = trackedSubscribeStatements(adapter, { matchAll: [new Uint8Array([1])] }, () => {});
    unsub();

    expect(innerUnsub).toHaveBeenCalledOnce();
  });

  it('does not double-count when the same returned unsubscribe is called twice', () => {
    const adapter = makeAdapter();
    const topic = new Uint8Array([1]);

    const unsub = trackedSubscribeStatements(adapter, { matchAll: [topic] }, () => {});
    unsub();
    unsub();

    expect(subscriptionRegistry.size()).toBe(0);
  });

  it('warns when the budget is exceeded', () => {
    const adapter = makeAdapter();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    for (let i = 0; i <= SUBSCRIPTION_BUDGET; i++) {
      trackedSubscribeStatements(adapter, { matchAll: [new Uint8Array([i])] }, () => {});
    }

    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/budget/i));
  });
});
