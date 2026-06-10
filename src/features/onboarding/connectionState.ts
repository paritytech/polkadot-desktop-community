import { type PeopleChainStatus } from '@/aggregates/network-settings';

import { type OnboardingConnectionState } from './types';

type DeriveInput = {
  peopleStatus: PeopleChainStatus;
  justRestored: boolean;
  // Non-null only when pairing is in its error step (the caller passes the
  // pairingError message and null otherwise), so its presence already implies
  // the error step — no separate step field is needed here.
  pairingMessage: string | null;
};

/**
 * STOPGAP: host-papp surfaces the brand-new-account / on-chain identity error
 * (`Individuality` / `OriginPersonProviderError`) only as a free-text pairing
 * message. Match the known markers until the SDK exposes a typed error code;
 * this is the single place that recognizes the condition.
 */
export function isAccountSetupPendingError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('originpersonprovider') || normalized.includes('individuality');
}

/**
 * Derives the onboarding connection panel state in strict precedence:
 * offline > (accountSetup | pairing-error) > (restored | reaching) > pairing.
 * `pairing` means "defer to the existing QR / pending / generic-error
 * rendering". A pairing error outranks a transient chain reconnect, so a real
 * authentication failure is never silently swallowed behind a reconnect
 * spinner; only a full browser-offline state preempts it.
 */
export function deriveOnboardingConnectionState(input: DeriveInput): OnboardingConnectionState {
  if (input.peopleStatus === 'offline') return 'offline';

  // A pairing error is a real authentication result — surface it (recognized
  // identity errors as the account-setup panel, everything else by deferring to
  // the plain pairing flow's error rendering) rather than hiding it behind a
  // reconnect.
  if (input.pairingMessage !== null) {
    return isAccountSetupPendingError(input.pairingMessage) ? 'accountSetup' : 'pairing';
  }

  if (input.peopleStatus === 'reconnecting') return input.justRestored ? 'restored' : 'reaching';

  return 'pairing';
}
