import { x25519 } from '@noble/curves/ed25519.js';
import { type SignedStatement } from '@novasamatech/sdk-statement';
import {
  type StatementStoreAdapter,
  deriveSlotAccountPublicKey,
  ensureSubstrateSlotSr25519Ready,
} from '@novasamatech/statement-store';
import { substrateSlotSecretFromSeedBytes } from '@novasamatech/substrate-slot-sr25519-wasm';
import { okAsync } from 'neverthrow';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { chatRequestGateway } from './gateway';

beforeAll(ensureSubstrateSlotSr25519Ready);

const aliceUserAccountId = new Uint8Array(32).fill(0xa1);
const bobUserAccountId = new Uint8Array(32).fill(0xb2);

const makeDevice = (entropyFill: number) => {
  const seed = substrateSlotSecretFromSeedBytes(new Uint8Array(32).fill(entropyFill));
  const publicKey = deriveSlotAccountPublicKey(seed);
  const encPriv = x25519.utils.randomSecretKey();
  const encPub = x25519.getPublicKey(encPriv);
  return { seed, publicKey, encPriv, encPub };
};

const makeUserChatKey = () => {
  const priv = x25519.utils.randomSecretKey();
  const pub = x25519.getPublicKey(priv);
  return { priv, pub };
};

const captureSubmittedData = (): {
  adapter: StatementStoreAdapter;
  capture: { current: SignedStatement | null };
} => {
  const capture: { current: SignedStatement | null } = { current: null };
  const adapter: StatementStoreAdapter = {
    queryStatements: vi.fn().mockReturnValue(okAsync([])),
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

describe('chatRequestGateway.sendChatRequestV2 (v0.2 spec-shape RequestContentV2: identityProof + deviceEncPubKey)', () => {
  it('round-trips from a desktop device to a wallet-bearing peer, decrypted with the identity chat key', async () => {
    const aliceDevice = makeDevice(0x01);
    const aliceUserChat = makeUserChatKey();
    const bobUserChat = makeUserChatKey();
    const { adapter, capture } = captureSubmittedData();

    await chatRequestGateway.sendChatRequestV2({
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

    const decoded = chatRequestGateway.decryptAndValidateRequestV2(stmt.data!, bobUserChat.priv);
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

    await chatRequestGateway.sendChatRequestV2({
      recipientAccountId: bobUserAccountId,
      recipientChatPubKey: bobUserChat.pub,
      senderIdentityAccountId: aliceUserAccountId,
      senderIdentityChatPrivateKey: aliceUserChat.priv,
      senderDevicePubKey: aliceDevice.encPub,
      senderDeviceSeed: aliceDevice.seed,
      statementStore: adapter,
    });

    const stmt = capture.current!;
    const decoded = chatRequestGateway.decryptAndValidateRequestV2(stmt.data!, wrongChat.priv);
    expect(decoded).toBeNull();
  });

  it('topic1 + topic2 are V1-style (recipient-keyed)', async () => {
    const aliceDevice = makeDevice(0x04);
    const aliceUserChat = makeUserChatKey();
    const bobUserChat = makeUserChatKey();
    const { adapter, capture } = captureSubmittedData();

    await chatRequestGateway.sendChatRequestV2({
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
