import { describe, expect, it } from 'vitest';

import { getPersistedPermissionStatus } from './permissionDecision';

describe('getPersistedPermissionStatus', () => {
  it('maps allow-once to ask so the app appears in permission settings', () => {
    expect(getPersistedPermissionStatus('allow-once')).toBe('ask');
  });

  it('maps allow-always to granted', () => {
    expect(getPersistedPermissionStatus('allow-always')).toBe('granted');
  });

  it('maps deny to denied', () => {
    expect(getPersistedPermissionStatus('deny')).toBe('denied');
  });

  it('maps dismiss to null', () => {
    expect(getPersistedPermissionStatus('dismiss')).toBeNull();
  });
});
