import { type PappAdapter } from '@novasamatech/host-papp';
import { okAsync } from 'neverthrow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hydrateUserIdentity, loadDeviceIdentity, loadUserIdentity } from './identity';
import { ensurePappProvider } from './provider';

// Pure, predictable derivations so the test asserts the SDK→app mapping, not crypto.
vi.mock('@/domains/device', () => ({
  deriveStatementAccountPublicKey: () => new Uint8Array([0xaa]),
  deriveEncryptionPublicKey: () => new Uint8Array([0xbb]),
}));

const userIdentitySet = vi.fn();
vi.mock('@/domains/sso', () => ({ userIdentity$: { set: (...args: unknown[]) => userIdentitySet(...args) } }));

vi.mock('./provider', () => ({ ensurePappProvider: vi.fn() }));

const SESSION = {
  id: 'sdk-session-1',
  identityChatPublicKey: new Uint8Array([1]),
  identityAccountId: new Uint8Array([2]),
  rootAccountId: new Uint8Array([3]),
  remoteAccount: { publicKey: new Uint8Array([4]), accountId: new Uint8Array([5]) },
  ssoEncPubKey: new Uint8Array([9]),
  // The peer device's encryption key lives in its own field — distinct from
  // remoteAccount.publicKey (the SSO shared secret, [4] above).
  deviceEncPubKey: new Uint8Array([10]),
};
const SECRETS = {
  ssSecret: new Uint8Array([6]),
  encrSecret: new Uint8Array([7]),
  identityChatPrivateKey: new Uint8Array([8]),
  entropy: new Uint8Array(0),
};

const fakeAdapter = (session: unknown, secrets: unknown): PappAdapter => {
  const adapter = {
    sessions: { sessions: { read: () => (session ? [session] : []) } },
    secrets: { read: () => okAsync(secrets) },
  };
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial test double for PappAdapter
  return adapter as unknown as PappAdapter;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadDeviceIdentity', () => {
  it('maps the SDK secrets to a DeviceIdentity', async () => {
    vi.mocked(ensurePappProvider).mockResolvedValue(fakeAdapter(SESSION, SECRETS));

    await expect(loadDeviceIdentity()).resolves.toEqual({
      statementAccountSeed: SECRETS.ssSecret,
      statementAccountPublicKey: new Uint8Array([0xaa]),
      encryptionPrivateKey: SECRETS.encrSecret,
      encryptionPublicKey: new Uint8Array([0xbb]),
    });
  });

  it('returns null when there is no V2 session', async () => {
    vi.mocked(ensurePappProvider).mockResolvedValue(fakeAdapter(null, null));

    await expect(loadDeviceIdentity()).resolves.toBeNull();
  });
});

describe('loadUserIdentity', () => {
  it('maps session + secrets to a UserIdentity', async () => {
    vi.mocked(ensurePappProvider).mockResolvedValue(fakeAdapter(SESSION, SECRETS));

    await expect(loadUserIdentity()).resolves.toEqual({
      identityChatPublicKey: SESSION.identityChatPublicKey,
      identityChatPrivateKey: SECRETS.identityChatPrivateKey,
      identitySr25519PublicKey: SESSION.identityAccountId,
      rootSr25519PublicKey: SESSION.rootAccountId,
      peerDeviceEncPubKey: SESSION.deviceEncPubKey,
      peerDeviceStatementAccountId: SESSION.remoteAccount.accountId,
      ssoEncPubKey: SESSION.ssoEncPubKey,
    });
  });

  it('reads ssoEncPubKey from the session when persisted (v0.2.2 peers)', async () => {
    vi.mocked(ensurePappProvider).mockResolvedValue(fakeAdapter(SESSION, SECRETS));

    const identity = await loadUserIdentity();

    expect(identity?.ssoEncPubKey).toEqual(SESSION.ssoEncPubKey);
  });

  it('falls back to null ssoEncPubKey for pre-v0.2.2 peers', async () => {
    vi.mocked(ensurePappProvider).mockResolvedValue(fakeAdapter({ ...SESSION, ssoEncPubKey: undefined }, SECRETS));

    const identity = await loadUserIdentity();

    expect(identity?.ssoEncPubKey).toBeNull();
  });

  it('normalises an all-zero rootAccountId to null', async () => {
    vi.mocked(ensurePappProvider).mockResolvedValue(fakeAdapter({ ...SESSION, rootAccountId: new Uint8Array(32) }, SECRETS));

    const identity = await loadUserIdentity();

    expect(identity?.rootSr25519PublicKey).toBeNull();
  });

  it('returns null when there is no V2 session', async () => {
    vi.mocked(ensurePappProvider).mockResolvedValue(fakeAdapter(null, null));

    await expect(loadUserIdentity()).resolves.toBeNull();
  });
});

describe('hydrateUserIdentity', () => {
  it('publishes the loaded identity on userIdentity$', async () => {
    vi.mocked(ensurePappProvider).mockResolvedValue(fakeAdapter(SESSION, SECRETS));

    await hydrateUserIdentity();

    expect(userIdentitySet).toHaveBeenCalledTimes(1);
    expect(userIdentitySet.mock.calls[0]?.[0]).toMatchObject({ identityChatPrivateKey: SECRETS.identityChatPrivateKey });
  });
});
