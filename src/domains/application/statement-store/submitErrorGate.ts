import { AccountFullError, ExpiryTooLowError } from '@novasamatech/statement-store';

/**
 * Whether a failed submit attempt belongs on the UI error stream
 * (`submitError$` → `useSubmitError` → SignPolkadotAppModal).
 *
 * AccountFull / ExpiryTooLow are per-attempt sync artifacts: every submit
 * path (library session, chat p2p, device-sync) retries them after raising
 * its expiry floor to the reported minimum, so they self-heal and must not
 * flash an error in the signing modal — especially since `submitError$` is a
 * global tap that also sees unrelated background submits (chat outbox,
 * device-sync, product postStatement). Terminal failures of other classes
 * (NoAllowance, store errors) still surface. A retry loop that exhausts on a
 * priority error reports through its OWN caller (chat outbox → message marked
 * failed; device-sync → orchestrator retry), not this stream. The signing
 * modal relies on the library session retrying priority errors indefinitely
 * while live — true for @novasamatech/statement-store releases with the
 * AccountFull-parity fix (> 0.8.7-2); do not ship this gate without that
 * dependency bump.
 */
export function shouldSurfaceSubmitError(error: Error): boolean {
  return !(error instanceof AccountFullError) && !(error instanceof ExpiryTooLowError);
}
