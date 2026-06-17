import { AccountFullError, ExpiryTooLowError, NoAllowanceError } from '@novasamatech/statement-store';
import { describe, expect, it } from 'vitest';

import { shouldSurfaceSubmitError } from './submitErrorGate';

describe('shouldSurfaceSubmitError', () => {
  it('suppresses transient priority errors that the submit paths retry', () => {
    expect(shouldSurfaceSubmitError(new AccountFullError(0n, 1n))).toBe(false);
    expect(shouldSurfaceSubmitError(new ExpiryTooLowError(0n, 1n))).toBe(false);
  });

  it('surfaces terminal errors', () => {
    expect(shouldSurfaceSubmitError(new NoAllowanceError())).toBe(true);
    expect(shouldSurfaceSubmitError(new Error('store rejected'))).toBe(true);
  });
});
