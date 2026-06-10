import { createState } from '@/shared/rxstate';
import { type UserIdentity } from '@/domains/device';

/**
 * Reactive holder for the V2 user identity (identity chat pubkey + identity
 * sr25519 pubkey). Set by `onPairingSuccess` (papp-provider) on a fresh
 * handshake and by `hydrateUserIdentity`, which reads it back from the SDK on
 * startup.
 *
 * `null` means "no V2 handshake has completed on this device yet" — UIs that
 * want to know whether a V2 user identity exists before letting the user
 * proceed should observe this state.
 */
export const userIdentity$ = createState<UserIdentity | null>(null);
