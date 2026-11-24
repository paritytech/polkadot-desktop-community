import { x25519 } from '@noble/curves/ed25519.js';
import { type SignedStatement } from '@novasamatech/sdk-statement';
import {
  type StatementStoreAdapter,
  createEncryption,
  deriveSlotAccountPublicKey,
  ensureSubstrateSlotSr25519Ready,
  signSlotAccountSecret,
  verifySr25519Signature,
} from '@novasamatech/statement-store';
import { substrateSlotSecretFromSeedBytes } from '@novasamatech/substrate-slot-sr25519-wasm';
import { okAsync } from 'neverthrow';
import { toHex } from 'polkadot-api/utils';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { p2pService } from '../service';

import { chatRequestGateway } from './gateway';
import { EncryptedRemoteModel, ProofPayload, RemoteModel } from './schemas';

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

function encryptCancelTo(params: {
  recipientChatPubKey: Uint8Array;
  signerSeed: Uint8Array;
  requestAcceptorId: Uint8Array;
  identityProof: Uint8Array;
}): Uint8Array {
  const message = {
    messageId: 'req-1',
    timestamp: 5n,
    content: {
      tag: 'cancel' as const,
      value: { identityProof: { identityAccountId: aliceUserAccountId, proof: params.identityProof } },
    },
  };
  const signature = signSlotAccountSecret(
    params.signerSeed,
    ProofPayload.enc({ message, requestAcceptorId: params.requestAcceptorId }),
  );
  const remote = RemoteModel.enc({
    message,
    proof: { tag: 'sr25519', value: { signature, signer: deriveSlotAccountPublicKey(params.signerSeed) } },
  });

  const ephemeralPrivKey = x25519.utils.randomSecretKey();
  const encryption = createEncryption(p2pService.computeSharedSecret(ephemeralPrivKey, params.recipientChatPubKey));
  return EncryptedRemoteModel.enc({
    encryptionPubKey: x25519.getPublicKey(ephemeralPrivKey),
    encryptedData: encryption.encrypt(remote)._unsafeUnwrap(),
  });
}

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

    expect(stmt.proof?.type === 'sr25519' ? stmt.proof.value.signer : null).toBe(toHex(aliceDevice.publicKey));

    const decoded = chatRequestGateway.decryptAndValidateRequestV2(stmt.data!, bobUserChat.priv, bobUserAccountId);
    expect(decoded?.tag).toBe('request');
    if (decoded?.tag !== 'request') return;
    const request = decoded.value;
    expect(request.welcomeMessage).toBe('hi from desktop');

    const envelope = EncryptedRemoteModel.dec(stmt.data!);
    const decrypted = createEncryption(p2pService.computeSharedSecret(bobUserChat.priv, envelope.encryptionPubKey)).decrypt(
      envelope.encryptedData,
    );
    const remote = RemoteModel.dec(decrypted._unsafeUnwrap());
    expect(remote.proof.tag).toBe('sr25519');
    const signed = ProofPayload.enc({ message: remote.message, requestAcceptorId: bobUserAccountId });
    expect(verifySr25519Signature(signed, remote.proof.value.signature, aliceDevice.publicKey)).toBe(true);
    // V2 content: senderAccountId is the user identity (not the publishing device).
    expect(Array.from(request.senderAccountId)).toEqual(Array.from(aliceUserAccountId));

    expect('senderDevicePubKey' in request).toBe(true);
    if ('senderDevicePubKey' in request) {
      expect(Array.from(request.senderIdentityAccountId)).toEqual(Array.from(aliceUserAccountId));
      expect(Array.from(request.senderDevicePubKey)).toEqual(Array.from(aliceDevice.encPub));
      expect(request.senderIdentityProof.length).toBe(32);
      // `proof.signer` is forced to equal the device sr25519 by IdentityProof
      // verification — the decoder surfaces it so the caller can key
      // Contact.devices[].statementAccountId and MultiRequest envelope entries
      // by the peer's real device sr25519, not the identity-conflated fallback.
      expect(Array.from(request.senderDeviceStatementAccountId)).toEqual(Array.from(aliceDevice.publicKey));
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
    const decoded = chatRequestGateway.decryptAndValidateRequestV2(stmt.data!, wrongChat.priv, bobUserAccountId);
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

describe('chatRequestGateway.decryptAndValidateRequestV2 (RFC 0007 cancel)', () => {
  it('decodes a cancel and checks its inner signature', () => {
    const aliceDevice = makeDevice(0x05);
    const bobUserChat = makeUserChatKey();
    const identityProof = new Uint8Array(32).fill(0xc3);

    const data = encryptCancelTo({
      recipientChatPubKey: bobUserChat.pub,
      signerSeed: aliceDevice.seed,
      requestAcceptorId: bobUserAccountId,
      identityProof,
    });

    expect(chatRequestGateway.decryptAndValidateRequestV2(data, bobUserChat.priv, bobUserAccountId)).toEqual({
      tag: 'cancel',
      value: {
        requestId: 'req-1',
        timestamp: 5,
        senderIdentityAccountId: aliceUserAccountId,
        identityProof,
      },
    });
  });

  it('drops a cancel whose inner signature does not verify', () => {
    const aliceDevice = makeDevice(0x06);
    const bobUserChat = makeUserChatKey();

    const data = encryptCancelTo({
      recipientChatPubKey: bobUserChat.pub,
      signerSeed: aliceDevice.seed,
      requestAcceptorId: aliceUserAccountId,
      identityProof: new Uint8Array(32).fill(0xc3),
    });

    expect(chatRequestGateway.decryptAndValidateRequestV2(data, bobUserChat.priv, bobUserAccountId)).toBeNull();
  });
});
