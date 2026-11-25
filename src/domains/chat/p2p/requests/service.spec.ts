// src/domains/chat/p2p/chatRequestTopics.spec.ts
import { khash } from '@novasamatech/statement-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { chatRequestService } from './service';

// April 2, 2025 00:00:00 UTC
const EPOCH_SECS = 1_763_164_800;

// Fixed inputs for iOS compatibility vector tests.
// These values should match the output of the equivalent Swift functions:
//   chatRequestService.computeAllPeerTopic    → ChatRequest+PaginationTopic.swift :: allPeerStatementsTopic(from:)
//   chatRequestService.computePaginationTopic → ChatRequest+PaginationTopic.swift :: paginationTopic(from:day:)
//   chatRequestService.computeChannelTopic    → ChatRequestFactory.swift          :: channelTopic
const FIXED_ACCOUNT_ID = new Uint8Array(32).fill(0xcd);
const FIXED_SESSION_ID = new Uint8Array(32).fill(0x11);
const FIXED_SHARED_SECRET = new Uint8Array(32).fill(0x22);

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

describe('getCurrentDay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns day 0 exactly at epoch', () => {
    vi.setSystemTime(EPOCH_SECS * 1000);
    expect(chatRequestService.getCurrentDay()?.day).toBe(BigInt(0));
  });

  it('returns day 1 exactly one day after epoch', () => {
    vi.setSystemTime((EPOCH_SECS + 86_400) * 1000);
    expect(chatRequestService.getCurrentDay()?.day).toBe(BigInt(1));
  });

  it('returns day 0 one second before the first day boundary', () => {
    vi.setSystemTime((EPOCH_SECS + 86_399) * 1000);
    expect(chatRequestService.getCurrentDay()?.day).toBe(BigInt(0));
  });

  it('returns null before the epoch', () => {
    vi.setSystemTime((EPOCH_SECS - 1) * 1000);
    expect(chatRequestService.getCurrentDay()).toBeNull();
  });

  it('returns remainedTillNext = 86400 at start of day 0', () => {
    vi.setSystemTime(EPOCH_SECS * 1000);
    expect(chatRequestService.getCurrentDay()?.remainedTillNext).toBe(86_400);
  });

  it('returns remainedTillNext = 82800 one hour into day 0', () => {
    vi.setSystemTime((EPOCH_SECS + 3_600) * 1000);
    expect(chatRequestService.getCurrentDay()?.remainedTillNext).toBe(82_800);
  });
});

describe('computeAllPeerTopic', () => {
  it('returns 32 bytes', () => {
    expect(chatRequestService.computeAllPeerTopic(FIXED_ACCOUNT_ID)).toHaveLength(32);
  });

  it('is deterministic', () => {
    expect(chatRequestService.computeAllPeerTopic(FIXED_ACCOUNT_ID)).toEqual(
      chatRequestService.computeAllPeerTopic(FIXED_ACCOUNT_ID),
    );
  });

  it('different account IDs yield different topics', () => {
    const a = chatRequestService.computeAllPeerTopic(new Uint8Array(32).fill(0x01));
    const b = chatRequestService.computeAllPeerTopic(new Uint8Array(32).fill(0x02));
    expect(a).not.toEqual(b);
  });

  // iOS compatibility vector — ChatRequest+PaginationTopic.swift :: allPeerStatementsTopic(from:)
  // On first run Vitest fills in the snapshot; verify the value matches iOS output for the same input.
  it('matches iOS allPeerStatementsTopic vector', () => {
    expect(toHex(chatRequestService.computeAllPeerTopic(FIXED_ACCOUNT_ID))).toMatchInlineSnapshot(
      `"28b70dc78c624968822216bee923a5048583f84909a51bba05851649a8deda38"`,
    );
  });
});

describe('computePaginationTopic', () => {
  it('returns 32 bytes', () => {
    expect(chatRequestService.computePaginationTopic(FIXED_ACCOUNT_ID, BigInt(0))).toHaveLength(32);
  });

  it('day 0 differs from day 1', () => {
    const day0 = chatRequestService.computePaginationTopic(FIXED_ACCOUNT_ID, BigInt(0));
    const day1 = chatRequestService.computePaginationTopic(FIXED_ACCOUNT_ID, BigInt(1));
    expect(day0).not.toEqual(day1);
  });

  it('is deterministic for same account and day', () => {
    expect(chatRequestService.computePaginationTopic(FIXED_ACCOUNT_ID, BigInt(5))).toEqual(
      chatRequestService.computePaginationTopic(FIXED_ACCOUNT_ID, BigInt(5)),
    );
  });

  it('different account IDs yield different topics for the same day', () => {
    const a = chatRequestService.computePaginationTopic(new Uint8Array(32).fill(0x01), BigInt(0));
    const b = chatRequestService.computePaginationTopic(new Uint8Array(32).fill(0x02), BigInt(0));
    expect(a).not.toEqual(b);
  });

  // iOS compatibility vector — ChatRequest+PaginationTopic.swift :: paginationTopic(from:day:)
  it('matches iOS paginationTopic vector day=0', () => {
    expect(toHex(chatRequestService.computePaginationTopic(FIXED_ACCOUNT_ID, BigInt(0)))).toMatchInlineSnapshot(
      `"e8a7a80a0824f569d5757207f29de4fd7dde9b03ba7aa9cf214c1ec7eb34e9df"`,
    );
  });

  it('matches iOS paginationTopic vector day=1', () => {
    expect(toHex(chatRequestService.computePaginationTopic(FIXED_ACCOUNT_ID, BigInt(1)))).toMatchInlineSnapshot(
      `"5ffebc38db45ecca594cdf72255134bfa58fb5169728c228ec7035593152ff8a"`,
    );
  });

  // iOS compatibility vector — ChatRequest+PaginationTopic.swift :: paginationTopic(from:day:)
  it('matches iOS paginationTopic vector day=100', () => {
    expect(toHex(chatRequestService.computePaginationTopic(FIXED_ACCOUNT_ID, BigInt(100)))).toMatchInlineSnapshot(
      `"124408ff61e31cd8adbcdcc6ca5a23b14d3d446b4529d28c5ca5b8c021e980b7"`,
    );
  });
});

describe('computeChannelTopic', () => {
  it('returns 32 bytes', () => {
    expect(chatRequestService.computeChannelTopic(FIXED_SESSION_ID, FIXED_SHARED_SECRET)).toHaveLength(32);
  });

  it('is deterministic', () => {
    expect(chatRequestService.computeChannelTopic(FIXED_SESSION_ID, FIXED_SHARED_SECRET)).toEqual(
      chatRequestService.computeChannelTopic(FIXED_SESSION_ID, FIXED_SHARED_SECRET),
    );
  });

  it('different session IDs yield different topics', () => {
    const a = chatRequestService.computeChannelTopic(new Uint8Array(32).fill(0x01), FIXED_SHARED_SECRET);
    const b = chatRequestService.computeChannelTopic(new Uint8Array(32).fill(0x02), FIXED_SHARED_SECRET);
    expect(a).not.toEqual(b);
  });

  it('different shared secrets yield different topics', () => {
    const a = chatRequestService.computeChannelTopic(FIXED_SESSION_ID, new Uint8Array(32).fill(0x01));
    const b = chatRequestService.computeChannelTopic(FIXED_SESSION_ID, new Uint8Array(32).fill(0x02));
    expect(a).not.toEqual(b);
  });

  // iOS compatibility vector — ChatRequestFactory.swift :: channelTopic
  it('matches iOS channelTopic vector', () => {
    expect(toHex(chatRequestService.computeChannelTopic(FIXED_SESSION_ID, FIXED_SHARED_SECRET))).toMatchInlineSnapshot(
      `"655629fba2e8b947fa439627b817a7eaed233ed5a0e37b54fd49699ec8243004"`,
    );
  });
});

describe('cancel proof', () => {
  const identityAccountId = new Uint8Array(32).fill(7);
  const sharedSecret = new Uint8Array(32).fill(0x33);
  const encoder = new TextEncoder();

  it('is khash of the SCALE payload laid out as the RFC fixes', () => {
    const payload = new Uint8Array([
      ...identityAccountId,
      0x14,
      ...encoder.encode('req-1'),
      0x5c,
      ...encoder.encode('mds-chat-request-cancel'),
    ]);

    expect(chatRequestService.computeCancelProof(sharedSecret, identityAccountId, 'req-1')).toEqual(khash(sharedSecret, payload));
  });

  it('accepts its own proof', () => {
    const proof = chatRequestService.computeCancelProof(sharedSecret, identityAccountId, 'req-1');

    expect(chatRequestService.isCancelProofValid(sharedSecret, { identityAccountId, proof }, 'req-1')).toBe(true);
  });

  it('rejects another request id, another identity and another key', () => {
    const proof = chatRequestService.computeCancelProof(sharedSecret, identityAccountId, 'req-1');

    expect(chatRequestService.isCancelProofValid(sharedSecret, { identityAccountId, proof }, 'req-2')).toBe(false);
    expect(
      chatRequestService.isCancelProofValid(sharedSecret, { identityAccountId: new Uint8Array(32).fill(8), proof }, 'req-1'),
    ).toBe(false);
    expect(chatRequestService.isCancelProofValid(new Uint8Array(32).fill(0x44), { identityAccountId, proof }, 'req-1')).toBe(
      false,
    );
  });
});

describe('identity proof', () => {
  const identityAccountId = new Uint8Array(32).fill(7);
  const statementAccountId = new Uint8Array(32).fill(9);
  const sharedSecret = new Uint8Array(32).fill(0x33);
  const encoder = new TextEncoder();

  it('is khash of the SCALE payload laid out as the spec fixes', () => {
    const payload = new Uint8Array([...identityAccountId, ...statementAccountId, 0x40, ...encoder.encode('mds-chat-request')]);

    expect(chatRequestService.computeIdentityProof(sharedSecret, identityAccountId, statementAccountId)).toEqual(
      khash(sharedSecret, payload),
    );
  });

  it('accepts its own proof', () => {
    const proof = chatRequestService.computeIdentityProof(sharedSecret, identityAccountId, statementAccountId);

    expect(chatRequestService.isIdentityProofValid(sharedSecret, { identityAccountId, proof }, statementAccountId)).toBe(true);
  });

  it('rejects another device, another identity and another key', () => {
    const proof = chatRequestService.computeIdentityProof(sharedSecret, identityAccountId, statementAccountId);

    expect(chatRequestService.isIdentityProofValid(sharedSecret, { identityAccountId, proof }, new Uint8Array(32).fill(10))).toBe(
      false,
    );
    expect(
      chatRequestService.isIdentityProofValid(
        sharedSecret,
        { identityAccountId: new Uint8Array(32).fill(8), proof },
        statementAccountId,
      ),
    ).toBe(false);
    expect(
      chatRequestService.isIdentityProofValid(new Uint8Array(32).fill(0x44), { identityAccountId, proof }, statementAccountId),
    ).toBe(false);
  });
});
