import { describe, expect, it } from 'vitest';

import { deriveOnboardingConnectionState, isAccountSetupPendingError } from './connectionState';

describe('isAccountSetupPendingError', () => {
  it('recognizes OriginPersonProvider errors', () => {
    expect(isAccountSetupPendingError('Module error: OriginPersonProviderError')).toBe(true);
  });

  it('recognizes Individuality errors', () => {
    expect(isAccountSetupPendingError('Individuality.SomethingNotReady')).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isAccountSetupPendingError('Network request timed out')).toBe(false);
  });
});

describe('deriveOnboardingConnectionState', () => {
  const base = {
    peopleStatus: 'connected' as const,
    justRestored: false,
    pairingMessage: null,
  };

  it('returns offline when the browser is offline', () => {
    expect(deriveOnboardingConnectionState({ ...base, peopleStatus: 'offline' })).toBe('offline');
  });

  it('returns reaching when reconnecting and not just restored', () => {
    expect(deriveOnboardingConnectionState({ ...base, peopleStatus: 'reconnecting' })).toBe('reaching');
  });

  it('returns restored when reconnecting right after coming back online', () => {
    expect(deriveOnboardingConnectionState({ ...base, peopleStatus: 'reconnecting', justRestored: true })).toBe('restored');
  });

  it('returns accountSetup when connected with a recognized identity error', () => {
    expect(
      deriveOnboardingConnectionState({
        ...base,
        pairingMessage: 'OriginPersonProviderError',
      }),
    ).toBe('accountSetup');
  });

  it('returns pairing when connected with an unrecognized error', () => {
    expect(deriveOnboardingConnectionState({ ...base, pairingMessage: 'boom' })).toBe('pairing');
  });

  it('returns pairing when connected with no error', () => {
    expect(deriveOnboardingConnectionState(base)).toBe('pairing');
  });

  it('surfaces a recognized identity error even while the chain is reconnecting', () => {
    expect(
      deriveOnboardingConnectionState({
        ...base,
        peopleStatus: 'reconnecting',
        pairingMessage: 'OriginPersonProviderError',
      }),
    ).toBe('accountSetup');
  });

  it('surfaces a generic pairing error instead of masking it behind reconnecting', () => {
    expect(deriveOnboardingConnectionState({ ...base, peopleStatus: 'reconnecting', pairingMessage: 'boom' })).toBe('pairing');
  });

  it('still prefers offline over a pending pairing error', () => {
    expect(deriveOnboardingConnectionState({ ...base, peopleStatus: 'offline', pairingMessage: 'boom' })).toBe('offline');
  });
});
