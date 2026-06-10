import { type HostMetadata, type PappAdapter, type StoredUserSession, createPappAdapter } from '@novasamatech/host-papp';
import { ensureSubstrateSlotSr25519Ready } from '@novasamatech/statement-store';
import { createLocalStorageAdapter } from '@novasamatech/storage-adapter';

import { getOperatingSystem } from '@/shared/env';
import { removeLocalStorageKeysByPrefix } from '@/shared/utils';
import { clearAllP2PChatStorage, clearAllProductChatStorage } from '@/domains/chat';
import { contactRepository } from '@/domains/contact';
import { type UserIdentity } from '@/domains/device';
import { deviceSyncRepository } from '@/domains/device-sync';
import { userIdentity$ } from '@/domains/sso';
import { lazyClient, statementStoreAdapter } from '../statement-store/service';

const version = process.env['VERSION'];

const pappStorage = createLocalStorageAdapter('Polkadot Desktop');

// Must run synchronously before the PappAdapter is constructed: host-papp@0.7.8
// SCALE-decodes the legacy V1 SsoSessions blob on its first localStorage read
// and throws `RangeError: Offset is outside the bounds of the DataView`.
export const migrateLegacySsoSessions = () => {
  if (typeof localStorage === 'undefined') return;
  const flagKey = 'polkadot_Polkadot Desktop_handshakeV2Migrated';
  if (localStorage.getItem(flagKey) === '1') return;
  localStorage.removeItem('polkadot_Polkadot Desktop_SsoSessions');
  localStorage.setItem(flagKey, '1');
};

// One-shot reset on first launch of a build whose persisted `environmentId` is
// incompatible with the previous one. Remote Config replaced the old fixed
// environment ids (e.g. `paseo-next-v2`) with `VITE_ENVIRONMENTS` channel ids, so
// a persisted legacy id matches no channel and would silently fall back to the
// default — a hidden network switch on update day. Wiping persisted Settings +
// SSO state drops the user back to onboarding on the configured default channel
// (`environmentsConfig.default`) with a fresh handshake.
// NOTE: the flag key is bumped per incompatible migration so the reset re-fires
// once for every install (the prior `…ToPaseoNextV2…` reset already ran for
// production installs, which is exactly why we need a new key here).
export const resetPersistedStateToDefaultEnvironment = () => {
  if (typeof localStorage === 'undefined') return;
  const flagKey = 'polkadot_Polkadot Desktop_resetToRemoteConfigChannelsMigrated';
  if (localStorage.getItem(flagKey) === '1') return;
  localStorage.removeItem('polkadot_pb:settings_value');
  localStorage.removeItem('polkadot_Polkadot Desktop_SsoSessions');
  localStorage.setItem(flagKey, '1');
};

// The device identity is owned and persisted by the SDK (host-papp's own
// `deviceIdentityStore`, obfuscated at rest). No app-side override — the app
// reads device + user identity back from the SDK via `./identity`.

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

const isAllZero = (bytes: Uint8Array): boolean => bytes.every(byte => byte === 0);

// A replayed Success carries the same identity — guard so we don't re-clear the
// per-user repos (wiping data the live orchestrator just synced) on every
// adapter re-mount.
const isSameIdentity = (current: UserIdentity | null, next: UserIdentity): boolean =>
  current !== null &&
  bytesEqual(current.peerDeviceStatementAccountId, next.peerDeviceStatementAccountId) &&
  bytesEqual(current.identityChatPublicKey, next.identityChatPublicKey) &&
  bytesEqual(current.identitySr25519PublicKey, next.identitySr25519PublicKey) &&
  bytesEqual(current.peerDeviceEncPubKey, next.peerDeviceEncPubKey);

// Fired by host-papp after it has already persisted the session + secrets (the
// SDK owns at-rest storage). We only fan the user-identity bits out to
// `userIdentity$` so the V2 chat/sync/SSO stack reacts, and clear the previous
// user's per-user repos when the identity actually changes.
const onPairingSuccess = async ({
  session,
  identityChatPrivateKey,
  ssoEncPubKey,
}: {
  session: StoredUserSession;
  identityChatPrivateKey: Uint8Array;
  ssoEncPubKey: Uint8Array | null;
}): Promise<void> => {
  const root = session.rootAccountId;
  const next: UserIdentity = {
    identityChatPublicKey: session.identityChatPublicKey ?? new Uint8Array(65),
    identityChatPrivateKey,
    identitySr25519PublicKey: session.identityAccountId ?? new Uint8Array(32),
    // Normalise the SDK's all-zero placeholder (peer omitted rootAccountId) to
    // null so product soft-derivation degrades instead of deriving from zeros.
    rootSr25519PublicKey: root && !isAllZero(root) ? root : null,
    // Peer device P-256 encryption key from the SDK's `deviceEncPubKey`, not
    // `remoteAccount.publicKey` (the 32-byte SSO shared secret).
    peerDeviceEncPubKey: session.deviceEncPubKey,
    peerDeviceStatementAccountId: session.remoteAccount.accountId,
    // `papp_encr_pub` per Mobile SSO v0.2.2; null for pre-v0.2.2 peers (every
    // build today), in which case the V2 SSO transport stays inactive and
    // operations like signPayload fall back to the `notSupported` stub path.
    ssoEncPubKey,
  };

  // The SDK replays a cached Success to fresh subscribers (every adapter
  // re-mount re-runs `authenticate()`). Without this guard each replay would
  // re-clear the device-sync + contact repos and respawn the orchestrator,
  // killing the in-flight WebRTC handshake before the data channel opens.
  if (isSameIdentity(userIdentity$.get(), next)) return;

  // Re-pair == potentially a different user (logout + new QR): drop the
  // previous user's device-sync peers and contacts before publishing. The
  // fresh device-sync session re-seeds PApp from `peerDeviceStatementAccountId`
  // and re-hydrates contacts from PApp's first `ChatsAdded` sync.
  await Promise.all([deviceSyncRepository.clearAll(), contactRepository.clearAll()]);
  userIdentity$.set(next);
};

export const createPappAdapterWithHostMetadata = (hostMetadata?: HostMetadata): PappAdapter => {
  void ensureSubstrateSlotSr25519Ready();

  return createPappAdapter({
    appId: 'Polkadot Desktop',
    hostMetadata,
    onAuthSuccess: onPairingSuccess,
    adapters: {
      lazyClient,
      statementStore: statementStoreAdapter,
      storage: pappStorage,
    },
  });
};

export const getHostMetadataForWeb = (): HostMetadata => ({
  hostName: 'Polkadot Desktop',
  hostVersion: version,
  platformType: getOperatingSystem(),
});

// host-papp persists the V2 session + per-user secrets in localStorage under
// the appId prefix; they survive a renderer reload. Wiping the session + the
// per-session UserSecrets clears the SDK-owned *user identity*. The
// *device* identity (`DeviceIdentity`) is intentionally NOT in this list: it's
// the device keypair, which should persist across a user-identity logout and
// only rotate on a full `performUserLogout` (see `clearSdkDeviceIdentity`).
//
// We list keys explicitly rather than wildcard-clearing the
// `polkadot_Polkadot Desktop_` prefix because the same prefix also stores
// one-shot migration flags (e.g. `resetToPaseoNextV2Migrated`); wiping
// those would re-run the migration on the next boot, which removes
// `polkadot_pb:settings_value` and resets the user's selected network to
// `DEFAULT_ENVIRONMENT_ID`. We don't want logout to silently reset network
// preferences.
const HOST_PAPP_KEYS_TO_CLEAR = ['polkadot_Polkadot Desktop_SsoSessions'];
const HOST_PAPP_USER_SECRETS_PREFIX = 'polkadot_Polkadot Desktop_UserSecrets_';
const HOST_PAPP_DEVICE_IDENTITY_KEY = 'polkadot_Polkadot Desktop_DeviceIdentity';

const clearHostPappLocalStorage = () => {
  if (typeof localStorage === 'undefined') return;
  for (const key of HOST_PAPP_KEYS_TO_CLEAR) {
    localStorage.removeItem(key);
  }
  // UserSecrets is stored per-session-id, so multiple keys may exist.
  removeLocalStorageKeysByPrefix(HOST_PAPP_USER_SECRETS_PREFIX);
};

// Rotate the device identity by dropping the SDK's persisted `DeviceIdentity`
// blob; host-papp regenerates a fresh keypair on the next `authenticate()`.
// This cryptographically erases any cached on-chain `HandshakeSuccess` — it was
// ECDH-encrypted to the encryption key we're discarding.
const clearSdkDeviceIdentity = () => {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(HOST_PAPP_DEVICE_IDENTITY_KEY);
};

/**
 * Rotate the device identity without a full logout. Used by the onboarding
 * "retry" path so a fresh pairing QR uses a new device keypair.
 */
export const resetDeviceIdentity = (): void => {
  clearSdkDeviceIdentity();
};

const reloadRenderer = () => {
  // Tanstack hash router preserves `#/<path>` across reloads. If the user
  // pressed Log Out from `/dashboard`, a bare reload returns them to
  // `/dashboard` (which has no auth guard); resetting the hash to root makes
  // the `/` route's `userIdentity$` check run and route them to /onboarding.
  if (typeof window !== 'undefined') {
    window.location.hash = '#/';
  }
  window.App?.reload() ?? window.location.reload();
};

/**
 * Tear down all V2 user-identity state and flip `userIdentity$` to `null`.
 *
 * Reached through `performUserLogout`, which the host-papp session-teardown
 * watcher (`watchHostPappSessionTeardown`) runs whenever the SDK session
 * disappears — the Log Out button, a network switch, or a peer-initiated
 * `Disconnected` all remove the session and converge here.
 *
 * Order matters: wipe the per-user repos BEFORE flipping `userIdentity$`. The
 * chat manager and device-sync orchestrator react to `userIdentity$` going null
 * and tear themselves down — if they observe the
 * transition while stale rows still exist on disk, their final reactive pass
 * may rearm against the old user's data and bleed into the next pairing.
 *
 * `onPairingSuccess` on the NEXT login also clears `contactRepository`
 * and `deviceSyncRepository`, but it doesn't run on logout, so we must do it
 * here to keep the previous user's roster + chat history from carrying over.
 *
 * `clearHostPappLocalStorage()` wipes the SDK-owned user identity (session +
 * per-session secrets). Without it, on the next cold-start `userIdentity$` is
 * null (so `/` routes to `/onboarding`) but the bare `baseAdapter` re-emits
 * the cached V1 `UserSession` and `useSession()` reports the user as
 * authenticated — pressing Skip lands on `/dashboard` looking logged in. The
 * device keypair is deliberately preserved here (rotated only by
 * `performUserLogout`).
 */
export const runV2Logout = async (): Promise<void> => {
  await Promise.all([
    contactRepository.clearAll(),
    deviceSyncRepository.clearAll(),
    clearAllP2PChatStorage(),
    clearAllProductChatStorage(),
  ]);
  clearHostPappLocalStorage();
  userIdentity$.set(null);
};

/**
 * Full user-initiated logout — runs `runV2Logout` (which clears the SDK-owned
 * user identity, the per-user repos, and host-papp's session cache), rotates
 * the device identity so the cached on-chain `HandshakeSuccess` becomes
 * unreadable, then reloads.
 *
 * The pairing topic is `khash(statementAccountId, encryptionPublicKey ||
 * "topic")` and the Success payload on it is AES-GCM encrypted via ECDH
 * against our `encryptionPublicKey`. Dropping the device keypair means the next
 * `authenticate()` subscribes to a brand new topic (no cached statements),
 * and any old Success'es still within bulletin-chain retention are
 * encrypted to a private key we no longer hold — cryptographically erased.
 *
 * The reload at the end resets module-level state captured at startup
 * (`bootstrap`'s memoised `device`), so subsequent re-pairs start clean.
 */
export const performUserLogout = async (): Promise<void> => {
  await runV2Logout();
  clearSdkDeviceIdentity();
  reloadRenderer();
};
