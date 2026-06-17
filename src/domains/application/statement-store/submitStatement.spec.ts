/* eslint-disable @typescript-eslint/consistent-type-assertions -- test doubles: shape only the members the code under test touches */
import {
  type Statement,
  type StatementProver,
  type StatementStoreAdapter,
  AccountFullError,
} from '@novasamatech/statement-store';
import { errAsync, okAsync } from 'neverthrow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { signAndSubmitStatement } from './submitStatement';

const NOW_SECS = 1_790_000_000;

const fakeProver = {
  generateMessageProof: (stmt: Statement) => okAsync(stmt),
} as unknown as StatementProver;

function makeStore(failFirstWithMin?: bigint) {
  const submitted: Statement[] = [];
  let calls = 0;
  const adapter = {
    queryStatements: vi.fn(() => okAsync([])),
    submitStatement: vi.fn((stmt: Statement) => {
      submitted.push(stmt);
      calls += 1;
      return failFirstWithMin !== undefined && calls === 1
        ? errAsync(new AccountFullError(stmt.expiry ?? 0n, failFirstWithMin))
        : okAsync(undefined);
    }),
  } as unknown as StatementStoreAdapter;
  return { adapter, submitted };
}

const callParams = (adapter: StatementStoreAdapter) => ({
  prover: fakeProver,
  statementStore: adapter,
  channel: new Uint8Array(32),
  topics: new Uint8Array(32),
  data: new Uint8Array([1]),
  logTag: 'test',
});

describe('signAndSubmitStatement (app policy)', () => {
  beforeEach(() => {
    // The wrapper mints a fresh private allocator per call, so each test starts
    // from a clean expiry floor with no shared module state to reset.
    vi.useFakeTimers();
    vi.setSystemTime(NOW_SECS * 1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('submits with the pinned-high expiry layout', async () => {
    const { adapter, submitted } = makeStore();

    await signAndSubmitStatement(callParams(adapter));

    expect(submitted).toHaveLength(1);
    expect((submitted[0]!.expiry ?? 0n) >> 32n).toBe(0xffff_ffffn);
  });

  it('seeds the one-shot allocator floor above a statement already live on the topic', async () => {
    // Already on this (account, channel) from a previous session, at a priority
    // far ABOVE the current wall clock — a fresh floor-0 allocator would mint
    // now's pinned-high value and tie/lose to it.
    const existingExpiry = (0xffff_ffffn << 32n) | 4_000_000_000n;
    const submitted: Statement[] = [];
    const adapter = {
      queryStatements: vi.fn(() => okAsync([{ expiry: existingExpiry } as Statement])),
      submitStatement: vi.fn((stmt: Statement) => {
        submitted.push(stmt);
        return okAsync(undefined);
      }),
    } as unknown as StatementStoreAdapter;

    await signAndSubmitStatement(callParams(adapter));

    expect(submitted).toHaveLength(1);
    // The expiry-floor seed lifts the allocator above the snapshot max, so the
    // first submit lands strictly higher — no priority-rejection bounce.
    expect(submitted[0]!.expiry ?? 0n).toBeGreaterThan(existingExpiry);
  });

  it('retries an AccountFull rejection above the chain-reported minimum', async () => {
    const chainMin = (0xffff_ffffn << 32n) | 4_000_000_000n;
    const { adapter, submitted } = makeStore(chainMin);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const promise = signAndSubmitStatement(callParams(adapter));
      await vi.advanceTimersByTimeAsync(600);
      await promise;
    } finally {
      warnSpy.mockRestore();
    }

    expect(submitted).toHaveLength(2);
    expect(submitted[1]!.expiry ?? 0n).toBeGreaterThan(chainMin);
  });

  it('clears AccountFull when the chain-reported minimum lost precision over the JSON-RPC wire', async () => {
    // min_expiry round-trips through a float64 and rounds DOWN to a 2048-step grid value;
    // a retry that adopts it verbatim crawls +1 and never reaches the true minimum.
    const FLOAT_STEP = 2048n;
    const epochLow = BigInt(NOW_SECS - 1_763_164_800); // PRIORITY_EPOCH_OFFSET
    const grid = ((0xffff_ffffn << 32n) | (epochLow + 10_000n)) & ~(FLOAT_STEP - 1n);
    const trueMin = grid + 1_000n; // the wire reports `grid`, 1000 below the true minimum
    const reportedMin = grid;

    const submitted: Statement[] = [];
    const adapter = {
      queryStatements: vi.fn(() => okAsync([])),
      submitStatement: vi.fn((stmt: Statement) => {
        submitted.push(stmt);
        const expiry = stmt.expiry ?? 0n;
        if (expiry > trueMin) return okAsync(undefined);
        return errAsync(new AccountFullError(expiry, reportedMin));
      }),
    } as unknown as StatementStoreAdapter;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const promise = signAndSubmitStatement(callParams(adapter));
      await vi.advanceTimersByTimeAsync(6000);
      await promise;
    } finally {
      warnSpy.mockRestore();
    }

    // The fix lifts the adopted floor a full step, so a retry submits strictly above the
    // TRUE minimum and the eviction clears within the bounded retries.
    expect((submitted.at(-1)?.expiry ?? 0n) > trueMin).toBe(true);
  });

  it('throws after exhausting the bounded retries on a persistent AccountFull', async () => {
    const submitted: Statement[] = [];
    const adapter = {
      queryStatements: vi.fn(() => okAsync([])),
      submitStatement: vi.fn((stmt: Statement) => {
        submitted.push(stmt);
        return errAsync(new AccountFullError(stmt.expiry ?? 0n, (stmt.expiry ?? 0n) + 1_000_000n));
      }),
    } as unknown as StatementStoreAdapter;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const promise = signAndSubmitStatement({ ...callParams(adapter), statementStore: adapter });
      promise.catch(() => undefined);
      await vi.advanceTimersByTimeAsync(6000);
      await expect(promise).rejects.toBeInstanceOf(AccountFullError);
    } finally {
      warnSpy.mockRestore();
    }

    expect(submitted).toHaveLength(4); // 1 initial + 3 bounded retries
  });
});
