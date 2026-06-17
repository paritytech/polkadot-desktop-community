import { describe, expect, it } from 'vitest';

import { submissionSecsFromExpiry } from './transport';

const EXPIRY_DURATION_SECS = 7 * 24 * 60 * 60;
const PRIORITY_EPOCH_OFFSET_SECS = 1_763_164_800;

describe('submissionSecsFromExpiry', () => {
  it('derives submission time from the low word for pinned-high expiries', () => {
    const submissionSecs = 1_790_000_000;
    const expiry = (0xffff_ffffn << 32n) | BigInt(submissionSecs - PRIORITY_EPOCH_OFFSET_SECS);

    expect(submissionSecsFromExpiry(expiry)).toBe(submissionSecs);
  });

  it('derives submission time from the high word for legacy expiries', () => {
    const submissionSecs = 1_790_000_000;
    const expiry = (BigInt(submissionSecs + EXPIRY_DURATION_SECS) << 32n) | 7n; // | seq

    expect(submissionSecsFromExpiry(expiry)).toBe(submissionSecs);
  });
});
