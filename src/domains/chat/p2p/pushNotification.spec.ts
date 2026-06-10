import { p256 } from '@noble/curves/nist.js';
import { createEncryption } from '@novasamatech/statement-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type Environment, environmentUseCase } from '@/domains/application';

import { computeSharedSecret } from './keys';
import { computePushId, getPlatformDeviceToken, getPushNotifyUrl, sendPushNotification } from './pushNotification';
import { type P2PRoom } from './types';

// `environmentUseCase.getById` now assembles the Environment from Remote Config;
// stub it with synthetic values, so these unit tests don't depend on a live RC fetch.
const IDENTITY_BACKEND = 'https://alpha-identity.example';
const IOS_BUNDLE = 'com.example.app';

beforeEach(() => {
  vi.spyOn(environmentUseCase, 'getById').mockImplementation(id =>
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial Environment; the push path only reads backendUrl + iosBundleId
    Promise.resolve({ id, backendUrl: IDENTITY_BACKEND, iosBundleId: IOS_BUNDLE } as Environment),
  );
});

const ALICE_ACCOUNT_ID = new Uint8Array(32).fill(0xaa);
const BOB_ACCOUNT_ID = new Uint8Array(32).fill(0xbb);

const ALICE_PRIV = new Uint8Array(32).fill(0x11);
const BOB_PRIV = new Uint8Array(32).fill(0x22);

const alice = { chatP256PrivateKey: ALICE_PRIV, chatP256PublicKey: p256.getPublicKey(ALICE_PRIV, false) };
const bob = { chatP256PrivateKey: BOB_PRIV, chatP256PublicKey: p256.getPublicKey(BOB_PRIV, false) };

describe('P2PRoom token fields', () => {
  it('accepts optional peerPushToken and peerPlatform', () => {
    const room: P2PRoom = {
      sessionId: 'peer-1',
      peerId: 'peer-1',
      peerUsername: 'alice',
      peerP256PublicKey: '0x01',
      userId: 'me',
      createdAt: Date.now(),
      peerPushToken: 'abc123',
      peerPlatform: 'Android',
      lastUpdate: Date.now(),
    };
    expect(room.peerPushToken).toBe('abc123');
    expect(room.peerPlatform).toBe('Android');
  });
});

describe('computePushId', () => {
  it('returns a 32-byte Uint8Array', () => {
    const sharedSecret = computeSharedSecret(alice.chatP256PrivateKey, bob.chatP256PublicKey);
    const pushId = computePushId(sharedSecret, ALICE_ACCOUNT_ID, BOB_ACCOUNT_ID);
    expect(pushId).toBeInstanceOf(Uint8Array);
    expect(pushId).toHaveLength(32);
  });

  it('produces deterministic output for same inputs', () => {
    const sharedSecret = computeSharedSecret(alice.chatP256PrivateKey, bob.chatP256PublicKey);
    const pushId1 = computePushId(sharedSecret, ALICE_ACCOUNT_ID, BOB_ACCOUNT_ID);
    const pushId2 = computePushId(sharedSecret, ALICE_ACCOUNT_ID, BOB_ACCOUNT_ID);
    expect(pushId1).toEqual(pushId2);
  });

  it('produces different output when account order is swapped', () => {
    const sharedSecret = computeSharedSecret(alice.chatP256PrivateKey, bob.chatP256PublicKey);
    const pushIdAB = computePushId(sharedSecret, ALICE_ACCOUNT_ID, BOB_ACCOUNT_ID);
    const pushIdBA = computePushId(sharedSecret, BOB_ACCOUNT_ID, ALICE_ACCOUNT_ID);
    expect(pushIdAB).not.toEqual(pushIdBA);
  });
});

describe('getPushNotifyUrl', () => {
  it('builds the notify URL from the Remote Config identity backend', async () => {
    await expect(getPushNotifyUrl('alpha')).resolves.toBe(`${IDENTITY_BACKEND}/api/v1/notify`);
    await expect(getPushNotifyUrl('beta')).resolves.toBe(`${IDENTITY_BACKEND}/api/v1/notify`);
  });
});

describe('getPlatformDeviceToken', () => {
  it('returns hex string as-is for iOS', () => {
    const apnsHex = 'aabb1122334455667788';
    expect(getPlatformDeviceToken(apnsHex, 'iOS')).toBe(apnsHex);
  });

  it('decodes hex-encoded UTF-8 back to raw string for Android', () => {
    // "dMf7token" → UTF-8 hex → should decode back
    const fcmToken = 'dMf7token';
    const hex = Array.from(new TextEncoder().encode(fcmToken))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    expect(getPlatformDeviceToken(hex, 'Android')).toBe(fcmToken);
  });

  it('returns hex string as-is for undefined platform', () => {
    const token = 'aabb1122';
    expect(getPlatformDeviceToken(token, undefined)).toBe(token);
  });
});

describe('sendPushNotification', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, sent: 1, failed: 0 }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends POST request with correct body fields', async () => {
    const sharedSecret = computeSharedSecret(alice.chatP256PrivateKey, bob.chatP256PublicKey);
    const encryption = createEncryption(sharedSecret);

    await sendPushNotification({
      deviceToken: 'abc123token',
      peerPlatform: 'iOS',
      sharedSecret,
      encryption,
      localAccountId: ALICE_ACCOUNT_ID,
      remoteAccountId: BOB_ACCOUNT_ID,
      messageId: 'msg-1',
      timestamp: 1000,
      content: { tag: 'text' as const, value: 'Hello!' },
      environmentId: 'alpha',
    });

    expect(fetch).toHaveBeenCalledOnce();
    const [url, options] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe(`${IDENTITY_BACKEND}/api/v1/notify`);
    expect(options?.method).toBe('POST');
    expect(options?.headers).toEqual({ 'Content-Type': 'application/json' });

    const body = JSON.parse(String(options?.body));
    expect(body.deviceToken).toBe('abc123token');
    expect(body.pushId).toHaveLength(64); // 32 bytes as hex
    expect(body.message).toBeTruthy(); // encrypted hex string
    expect(body.voip).toBe(false);
    expect(body.platform).toBe('ios');
    expect(body.bundlerId).toBe(IOS_BUNDLE);
  });

  it('includes platform and bundlerId for iOS peers', async () => {
    const sharedSecret = computeSharedSecret(alice.chatP256PrivateKey, bob.chatP256PublicKey);
    const encryption = createEncryption(sharedSecret);

    await sendPushNotification({
      deviceToken: 'abc123token',
      peerPlatform: 'iOS',
      sharedSecret,
      encryption,
      localAccountId: ALICE_ACCOUNT_ID,
      remoteAccountId: BOB_ACCOUNT_ID,
      messageId: 'msg-ios',
      timestamp: 1000,
      content: { tag: 'text' as const, value: 'Hello!' },
      environmentId: 'beta',
    });

    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]![1]?.body));
    expect(body.platform).toBe('ios');
    expect(body.bundlerId).toBe(IOS_BUNDLE); // iOS → app bundle
  });

  it('converts Android device token from hex to UTF-8 string and sets platform', async () => {
    const sharedSecret = computeSharedSecret(alice.chatP256PrivateKey, bob.chatP256PublicKey);
    const encryption = createEncryption(sharedSecret);
    const fcmToken = 'cFcmToken123';
    const hexToken = Array.from(new TextEncoder().encode(fcmToken))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    await sendPushNotification({
      deviceToken: hexToken,
      peerPlatform: 'Android',
      sharedSecret,
      encryption,
      localAccountId: ALICE_ACCOUNT_ID,
      remoteAccountId: BOB_ACCOUNT_ID,
      messageId: 'msg-android',
      timestamp: 1000,
      content: { tag: 'text' as const, value: 'Hello!' },
      environmentId: 'alpha',
    });

    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]![1]?.body));
    expect(body.deviceToken).toBe(fcmToken);
    expect(body.platform).toBe('android');
    expect(body.bundlerId).toBeUndefined();
  });

  it('sets voip to true for callOffer content', async () => {
    const sharedSecret = computeSharedSecret(alice.chatP256PrivateKey, bob.chatP256PublicKey);
    const encryption = createEncryption(sharedSecret);

    await sendPushNotification({
      deviceToken: 'abc123token',
      peerPlatform: 'iOS',
      sharedSecret,
      encryption,
      localAccountId: ALICE_ACCOUNT_ID,
      remoteAccountId: BOB_ACCOUNT_ID,
      messageId: 'msg-2',
      timestamp: 1000,
      content: { tag: 'dataChannelOffer' as const, value: { sdp: new Uint8Array(), purpose: 'AUDIO_CALL' as const } },
      environmentId: 'beta',
    });

    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]![1]?.body));
    expect(body.voip).toBe(true);
  });

  it('does not throw when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const sharedSecret = computeSharedSecret(alice.chatP256PrivateKey, bob.chatP256PublicKey);
    const encryption = createEncryption(sharedSecret);

    await sendPushNotification({
      deviceToken: 'abc123token',
      peerPlatform: undefined,
      sharedSecret,
      encryption,
      localAccountId: ALICE_ACCOUNT_ID,
      remoteAccountId: BOB_ACCOUNT_ID,
      messageId: 'msg-3',
      timestamp: 1000,
      content: { tag: 'text' as const, value: 'Hello!' },
      environmentId: 'beta',
    });
  });
});
