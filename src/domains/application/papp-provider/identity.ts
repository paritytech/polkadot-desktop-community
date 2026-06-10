import { type PappAdapter, type UserSession } from '@novasamatech/host-papp';

import {
  type DeviceIdentity,
  type UserIdentity,
  deriveEncryptionPublicKey,
  deriveStatementAccountPublicKey,
} from '@/domains/device';
import { userIdentity$ } from '@/domains/sso';

import { ensurePappProvider } from './provider';

// Identity is owned and persisted by the SDK (host-papp): on a successful V2
// pairing it writes the session (`adapter.sessions`) and mirrors the device
// secrets + `identityChatPrivateKey` into `adapter.secrets`, keyed by session
// id, under its own at-rest obfuscation. These readers reconstruct the app's
// `DeviceIdentity` / `UserIdentity` shapes from that SDK-owned state — the app
// no longer persists any key material itself.

const isAllZero = (bytes: Uint8Array): boolean => bytes.every(byte => byte === 0);

// The SDK keeps V2 sessions alongside any legacy V1 rows; V2 sessions are the
// ones carrying user-identity fields. There is at most one after a pairing.
const findV2Session = (adapter: PappAdapter): UserSession | null =>
  adapter.sessions.sessions.read().find(session => session.identityChatPublicKey != null && session.identityAccountId != null) ??
  null;

export const loadDeviceIdentity = async (): Promise<DeviceIdentity | null> => {
  const adapter = await ensurePappProvider();
  const session = findV2Session(adapter);
  if (!session) return null;
  const secrets = (await adapter.secrets.read(session.id)).unwrapOr(null);
  if (!secrets) return null;
  return {
    // host-papp's `ssSecret` IS the 64-byte expanded sr25519 secret our
    // `DeviceIdentity` calls `statementAccountSeed`; `encrSecret` is the P-256
    // encryption private key.
    statementAccountSeed: secrets.ssSecret,
    statementAccountPublicKey: deriveStatementAccountPublicKey(secrets.ssSecret),
    encryptionPrivateKey: secrets.encrSecret,
    encryptionPublicKey: deriveEncryptionPublicKey(secrets.encrSecret),
  };
};

export const loadUserIdentity = async (): Promise<UserIdentity | null> => {
  const adapter = await ensurePappProvider();
  const session = findV2Session(adapter);
  if (!session) return null;
  const secrets = (await adapter.secrets.read(session.id)).unwrapOr(null);
  if (!secrets) return null;
  const identityChatPublicKey = session.identityChatPublicKey;
  const identitySr25519PublicKey = session.identityAccountId;
  if (!identityChatPublicKey || !identitySr25519PublicKey) return null;
  const root = session.rootAccountId;
  return {
    identityChatPublicKey,
    identityChatPrivateKey: secrets.identityChatPrivateKey,
    identitySr25519PublicKey,
    // The SDK stores an all-zero accountId when the peer omitted rootAccountId
    // (pre-v0.2.1); normalise that back to null so product soft-derivation
    // degrades gracefully rather than deriving from zeros.
    rootSr25519PublicKey: root && !isAllZero(root) ? root : null,
    // The peer device's P-256 encryption key, persisted by the SDK as
    // `deviceEncPubKey`. NOT `remoteAccount.publicKey` — that field holds the
    // 32-byte SSO ECDH shared secret, which device-sync would reject as a
    // public key.
    peerDeviceEncPubKey: session.deviceEncPubKey,
    peerDeviceStatementAccountId: session.remoteAccount.accountId,
    // `papp_encr_pub` (Mobile SSO v0.2.2). The SDK persists it on the session,
    // so on cold start the SSO transport (sign/vrf) is reconstructed without a
    // re-handshake. Null for pre-v0.2.2 peers (every PApp build today).
    ssoEncPubKey: session.ssoEncPubKey ?? null,
  };
};

/**
 * Read the persisted V2 user identity from the SDK and publish it on
 * `userIdentity$` so reactive consumers (usePappProvider, route loaders) pick
 * it up. Idempotent — safe to call from both bootstrap and the `/` loader.
 */
export const hydrateUserIdentity = async (): Promise<void> => {
  userIdentity$.set(await loadUserIdentity());
};
