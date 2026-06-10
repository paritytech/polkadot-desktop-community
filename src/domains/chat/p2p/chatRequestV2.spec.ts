import { p256 } from '@noble/curves/nist.js';
import { type SignedStatement } from '@novasamatech/sdk-statement';
import { type StatementStoreAdapter, createSr25519Secret, deriveSr25519PublicKey } from '@novasamatech/statement-store';
import { okAsync } from 'neverthrow';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { decryptAndValidateRequestV2, sendChatRequestV2 } from './chatRequestV2';

const aliceUserAccountId = new Uint8Array(32).fill(0xa1);
const bobUserAccountId = new Uint8Array(32).fill(0xb2);

const makeDevice = (entropyFill: number) => {
  const seed = createSr25519Secret(new Uint8Array(32).fill(entropyFill));
  const publicKey = deriveSr25519PublicKey(seed);
  const encPriv = p256.utils.randomSecretKey();
  const encPub = p256.getPublicKey(encPriv, false);
  return { seed, publicKey, encPriv, encPub };
};

const makeUserChatKey = () => {
  const priv = p256.utils.randomSecretKey();
  const pub = p256.getPublicKey(priv, false);
  return { priv, pub };
};

const captureSubmittedData = (): {
  adapter: StatementStoreAdapter;
  capture: { current: SignedStatement | null };
} => {
  const capture: { current: SignedStatement | null } = { current: null };
  const adapter: StatementStoreAdapter = {
    queryStatements: vi.fn(),
    submitStatement: vi.fn().mockImplementation((stmt: SignedStatement) => {
      capture.current = stmt;
      return okAsync(undefined);
    }),
    subscribeStatements: vi.fn().mockReturnValue(() => {}),
  };
  return { adapter, capture };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sendChatRequestV2 (v0.2 spec-shape RequestContentV2: identityProof + deviceEncPubKey)', () => {
  it('round-trips: desktop (Alice device) → wallet-bearing peer (Bob); recipient decrypts with identity chat priv', async () => {
    const aliceDevice = makeDevice(0x01);
    const aliceUserChat = makeUserChatKey();
    const bobUserChat = makeUserChatKey();
    const { adapter, capture } = captureSubmittedData();

    await sendChatRequestV2({
      recipientAccountId: bobUserAccountId,
      recipientChatPubKey: bobUserChat.pub,
      senderIdentityAccountId: aliceUserAccountId,
      senderIdentityChatPrivateKey: aliceUserChat.priv,
      senderDevicePubKey: aliceDevice.encPub,
      senderDeviceSeed: aliceDevice.seed,
      welcomeMessage: 'hi from desktop',
      statementStore: adapter,
    });

    const submitted = capture.current;
    expect(submitted).not.toBeNull();
    const stmt = submitted!;
    expect(stmt.data).toBeDefined();

    const decoded = decryptAndValidateRequestV2(stmt.data!, bobUserChat.priv);
    expect(decoded).not.toBeNull();
    expect(decoded!.welcomeMessage).toBe('hi from desktop');
    // V2 content: senderAccountId is the user identity (not the publishing device).
    expect(Array.from(decoded!.senderAccountId)).toEqual(Array.from(aliceUserAccountId));

    expect('senderDevicePubKey' in decoded!).toBe(true);
    if ('senderDevicePubKey' in decoded!) {
      expect(Array.from(decoded.senderIdentityAccountId)).toEqual(Array.from(aliceUserAccountId));
      expect(Array.from(decoded.senderDevicePubKey)).toEqual(Array.from(aliceDevice.encPub));
      expect(decoded.senderIdentityProof.length).toBe(32);
      // `proof.signer` is forced to equal the device sr25519 by IdentityProof
      // verification — the decoder surfaces it so the caller can key
      // Contact.devices[].statementAccountId and MultiRequest envelope entries
      // by the peer's real device sr25519, not the identity-conflated fallback.
      expect(Array.from(decoded.senderDeviceStatementAccountId)).toEqual(Array.from(aliceDevice.publicKey));
    }
  });

  it('returns null when decrypt fails (e.g. wrong chat priv key)', async () => {
    const aliceDevice = makeDevice(0x03);
    const aliceUserChat = makeUserChatKey();
    const bobUserChat = makeUserChatKey();
    const wrongChat = makeUserChatKey();
    const { adapter, capture } = captureSubmittedData();

    await sendChatRequestV2({
      recipientAccountId: bobUserAccountId,
      recipientChatPubKey: bobUserChat.pub,
      senderIdentityAccountId: aliceUserAccountId,
      senderIdentityChatPrivateKey: aliceUserChat.priv,
      senderDevicePubKey: aliceDevice.encPub,
      senderDeviceSeed: aliceDevice.seed,
      statementStore: adapter,
    });

    const stmt = capture.current!;
    const decoded = decryptAndValidateRequestV2(stmt.data!, wrongChat.priv);
    expect(decoded).toBeNull();
  });

  it('topic1 + topic2 are V1-style (recipient-keyed)', async () => {
    const aliceDevice = makeDevice(0x04);
    const aliceUserChat = makeUserChatKey();
    const bobUserChat = makeUserChatKey();
    const { adapter, capture } = captureSubmittedData();

    await sendChatRequestV2({
      recipientAccountId: bobUserAccountId,
      recipientChatPubKey: bobUserChat.pub,
      senderIdentityAccountId: aliceUserAccountId,
      senderIdentityChatPrivateKey: aliceUserChat.priv,
      senderDevicePubKey: aliceDevice.encPub,
      senderDeviceSeed: aliceDevice.seed,
      statementStore: adapter,
    });

    const stmt = capture.current!;
    // Statement has 3 topics: allPeer, paginationDay, channel — no sender-derived topics
    expect(stmt.topics?.length).toBe(3);
  });
});
