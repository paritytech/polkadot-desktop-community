import { describe, expect, it } from 'vitest';

import { createPermissionStatusBridge, getRemoteStatusKey, resolvePermissionStatus } from './permissionStatusBridge';

describe('resolvePermissionStatus', () => {
  it('prefers local override over stale persisted value', () => {
    expect(resolvePermissionStatus('denied', 'ask')).toBe('denied');
  });

  it('falls back to persisted when override is missing', () => {
    expect(resolvePermissionStatus(undefined, 'granted')).toBe('granted');
  });

  it('defaults to ask when neither override nor persisted value exists', () => {
    expect(resolvePermissionStatus(undefined, undefined)).toBe('ask');
  });
});

describe('getRemoteStatusKey', () => {
  it('sorts Remote values so equivalent requests share one override key', () => {
    expect(
      getRemoteStatusKey({
        tag: 'Remote',
        value: ['https://b.example.com', 'https://a.example.com'],
      }),
    ).toBe(
      getRemoteStatusKey({
        tag: 'Remote',
        value: ['https://a.example.com', 'https://b.example.com'],
      }),
    );
  });

  it('uses the request tag for non-Remote permissions', () => {
    expect(getRemoteStatusKey({ tag: 'PreimageSubmit' })).toBe('PreimageSubmit');
  });
});

describe('createPermissionStatusBridge', () => {
  it('returns denied on repeat request before persisted permissions refresh', () => {
    const bridge = createPermissionStatusBridge();

    bridge.setOverride('PreimageSubmit', 'denied');

    expect(bridge.getStatus('PreimageSubmit', () => undefined)).toBe('denied');
  });

  it('uses persisted status once the reactive store has caught up', () => {
    const bridge = createPermissionStatusBridge();

    expect(bridge.getStatus('ChainSubmit', () => 'granted')).toBe('granted');
  });
});
