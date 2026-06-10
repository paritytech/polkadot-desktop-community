import { describe, expect, it } from 'vitest';

import { computeAllPeerTopicV2, computePaginationTopicV2, computePeerSubscriptionTopicsV2 } from './chatRequestTopicsV2';

const senderDevice = (fill: number) => new Uint8Array(32).fill(fill);
const recipientUser = (fill: number) => new Uint8Array(32).fill(fill);

describe('computeAllPeerTopicV2', () => {
  it('returns a 32-byte topic', () => {
    const topic = computeAllPeerTopicV2(senderDevice(0xaa), recipientUser(0xbb));
    expect(topic.length).toBe(32);
  });

  it('is deterministic for the same inputs', () => {
    const a = computeAllPeerTopicV2(senderDevice(0xaa), recipientUser(0xbb));
    const b = computeAllPeerTopicV2(senderDevice(0xaa), recipientUser(0xbb));
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('differs when the sender device changes', () => {
    const a = computeAllPeerTopicV2(senderDevice(0xaa), recipientUser(0xbb));
    const b = computeAllPeerTopicV2(senderDevice(0xcc), recipientUser(0xbb));
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('differs when the recipient user changes', () => {
    const a = computeAllPeerTopicV2(senderDevice(0xaa), recipientUser(0xbb));
    const b = computeAllPeerTopicV2(senderDevice(0xaa), recipientUser(0xdd));
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('is asymmetric in (senderDevice, recipientUser) — swapping changes the topic', () => {
    const ab = computeAllPeerTopicV2(senderDevice(0xaa), recipientUser(0xbb));
    const ba = computeAllPeerTopicV2(senderDevice(0xbb), recipientUser(0xaa));
    expect(Buffer.from(ab).equals(Buffer.from(ba))).toBe(false);
  });
});

describe('computePaginationTopicV2', () => {
  it('returns a 32-byte topic', () => {
    const topic = computePaginationTopicV2(senderDevice(0xaa), recipientUser(0xbb), 1n);
    expect(topic.length).toBe(32);
  });

  it('differs when the day changes', () => {
    const a = computePaginationTopicV2(senderDevice(0xaa), recipientUser(0xbb), 1n);
    const b = computePaginationTopicV2(senderDevice(0xaa), recipientUser(0xbb), 2n);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('differs from the no-day variant for the same identities', () => {
    const day = computePaginationTopicV2(senderDevice(0xaa), recipientUser(0xbb), 0n);
    const all = computeAllPeerTopicV2(senderDevice(0xaa), recipientUser(0xbb));
    expect(Buffer.from(day).equals(Buffer.from(all))).toBe(false);
  });
});

describe('computePeerSubscriptionTopicsV2', () => {
  it('returns one pagination topic per known sender device', () => {
    const topics = computePeerSubscriptionTopicsV2(
      [senderDevice(0x01), senderDevice(0x02), senderDevice(0x03)],
      recipientUser(0xbb),
      5n,
    );
    expect(topics).toHaveLength(3);
    for (const t of topics) {
      expect(t.length).toBe(32);
    }
  });

  it('returns empty when the contact has no known devices (V1-fallback signal)', () => {
    expect(computePeerSubscriptionTopicsV2([], recipientUser(0xbb), 5n)).toEqual([]);
  });

  it('topics line up with computePaginationTopicV2 for each device', () => {
    const senderDevices = [senderDevice(0x01), senderDevice(0x02)];
    const recipient = recipientUser(0xbb);
    const day = 7n;

    const subscribed = computePeerSubscriptionTopicsV2(senderDevices, recipient, day);
    expect(Buffer.from(subscribed[0]!).equals(Buffer.from(computePaginationTopicV2(senderDevices[0]!, recipient, day)))).toBe(
      true,
    );
    expect(Buffer.from(subscribed[1]!).equals(Buffer.from(computePaginationTopicV2(senderDevices[1]!, recipient, day)))).toBe(
      true,
    );
  });
});
