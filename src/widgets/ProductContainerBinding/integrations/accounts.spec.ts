import { describe, expect, it } from 'vitest';

import { decideAliasPermissionEffect } from './aliasPermissionDecision';

describe('decideAliasPermissionEffect', () => {
  it('maps allow-once to one-time allowance effect', () => {
    expect(decideAliasPermissionEffect('allow-once')).toBe('allow-once');
  });

  it('maps allow-always to persistent granted effect', () => {
    expect(decideAliasPermissionEffect('allow-always')).toBe('persist-granted');
  });

  it('maps deny to persistent denied effect', () => {
    expect(decideAliasPermissionEffect('deny')).toBe('persist-denied');
  });

  it('maps dismiss to reject effect', () => {
    expect(decideAliasPermissionEffect('dismiss')).toBe('reject');
  });
});
