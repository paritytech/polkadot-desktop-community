import { describe, expect, it } from 'vitest';

import { computeRosterSubscriptionTopics, computeRosterTopic } from './rosterTopics';

const accountId = (fill: number) => new Uint8Array(32).fill(fill);

describe('computeRosterTopic', () => {
  it('returns a 32-byte topic', () => {
    expect(computeRosterTopic(accountId(0xa1)).length).toBe(32);
  });

  it('is deterministic for the same accountId', () => {
    const a = computeRosterTopic(accountId(0xa1));
    const b = computeRosterTopic(accountId(0xa1));
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('differs for different accountIds', () => {
    const a = computeRosterTopic(accountId(0xa1));
    const b = computeRosterTopic(accountId(0xa2));
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });
});

describe('computeRosterSubscriptionTopics', () => {
  it('returns one topic per known contact', () => {
    const topics = computeRosterSubscriptionTopics([accountId(0x01), accountId(0x02), accountId(0x03)]);
    expect(topics).toHaveLength(3);
    for (const t of topics) {
      expect(t.length).toBe(32);
    }
  });

  it('returns empty when there are no contacts', () => {
    expect(computeRosterSubscriptionTopics([])).toEqual([]);
  });

  it('topics line up with computeRosterTopic for each contact', () => {
    const a = accountId(0x01);
    const b = accountId(0x02);
    const subscribed = computeRosterSubscriptionTopics([a, b]);
    expect(Buffer.from(subscribed[0]!).equals(Buffer.from(computeRosterTopic(a)))).toBe(true);
    expect(Buffer.from(subscribed[1]!).equals(Buffer.from(computeRosterTopic(b)))).toBe(true);
  });
});
