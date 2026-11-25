import { x25519 } from '@noble/curves/ed25519.js';
import { type SignedStatement } from '@novasamatech/sdk-statement';
import {
  type StatementStoreAdapter,
  createEncryption,
  createInMemoryStatementStore,
  deriveSlotAccountPublicKey,
  ensureSubstrateSlotSr25519Ready,
  signSlotAccountSecret,
  verifySr25519Signature,
} from '@novasamatech/statement-store';
import { substrateSlotSecretFromSeedBytes } from '@novasamatech/substrate-slot-sr25519-wasm';
import { errAsync, okAsync } from 'neverthrow';
import { toHex } from 'polkadot-api/utils';
import { type CodecType } from 'scale-ts';
import { type MockInstance, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { p2pService } from '../service';

import { chatRequestGateway } from './gateway';
import { EncryptedRemoteModel, ProofPayload, RemoteModel } from './schemas';
import { chatRequestService } from './service';

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

function encryptRequestMessageTo(params: {
  recipientChatPubKey: Uint8Array;
  signerSeed: Uint8Array;
  requestAcceptorId: Uint8Array;
  content: CodecType<typeof RemoteModel>['message']['content'];
}): Uint8Array {
  const message = { messageId: 'req-1', timestamp: 5n, content: params.content };
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

    const data = encryptRequestMessageTo({
      recipientChatPubKey: bobUserChat.pub,
      signerSeed: aliceDevice.seed,
      requestAcceptorId: bobUserAccountId,
      content: { tag: 'cancel', value: { identityProof: { identityAccountId: aliceUserAccountId, proof: identityProof } } },
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

    const data = encryptRequestMessageTo({
      recipientChatPubKey: bobUserChat.pub,
      signerSeed: aliceDevice.seed,
      requestAcceptorId: aliceUserAccountId,
      content: {
        tag: 'cancel',
        value: { identityProof: { identityAccountId: aliceUserAccountId, proof: new Uint8Array(32).fill(0xc3) } },
      },
    });

    expect(chatRequestGateway.decryptAndValidateRequestV2(data, bobUserChat.priv, bobUserAccountId)).toBeNull();
  });
});

describe('chatRequestGateway.decryptAndValidateRequestV2 (inner signature)', () => {
  const v1Content = {
    tag: 'v1' as const,
    value: { pushToken: undefined, welcomeMessage: { text: 'hi', attachments: undefined } },
  };
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('decodes a v1 request signed for this receiver, keyed by its signer', () => {
    const device = makeDevice(0x07);
    const bobUserChat = makeUserChatKey();

    const data = encryptRequestMessageTo({
      recipientChatPubKey: bobUserChat.pub,
      signerSeed: device.seed,
      requestAcceptorId: bobUserAccountId,
      content: v1Content,
    });

    const decoded = chatRequestGateway.decryptAndValidateRequestV2(data, bobUserChat.priv, bobUserAccountId);
    expect(decoded?.tag).toBe('request');
    if (decoded?.tag !== 'request') return;
    expect(decoded.value.welcomeMessage).toBe('hi');
    expect(Array.from(decoded.value.senderAccountId)).toEqual(Array.from(device.publicKey));
  });

  it('drops a v1 request signed for another receiver', () => {
    const device = makeDevice(0x07);
    const bobUserChat = makeUserChatKey();

    const data = encryptRequestMessageTo({
      recipientChatPubKey: bobUserChat.pub,
      signerSeed: device.seed,
      requestAcceptorId: aliceUserAccountId,
      content: v1Content,
    });

    expect(chatRequestGateway.decryptAndValidateRequestV2(data, bobUserChat.priv, bobUserAccountId)).toBeNull();
    expect(warn).toHaveBeenCalledWith('[chat-request-v2] inner signature invalid');
  });

  it('drops a v2 request signed for another receiver', () => {
    const device = makeDevice(0x07);
    const bobUserChat = makeUserChatKey();

    const data = encryptRequestMessageTo({
      recipientChatPubKey: bobUserChat.pub,
      signerSeed: device.seed,
      requestAcceptorId: aliceUserAccountId,
      content: {
        tag: 'v2',
        value: {
          identityProof: { identityAccountId: aliceUserAccountId, proof: new Uint8Array(32).fill(0xc3) },
          deviceEncPubKey: device.encPub,
          pushToken: undefined,
          welcomeMessage: undefined,
        },
      },
    });

    expect(chatRequestGateway.decryptAndValidateRequestV2(data, bobUserChat.priv, bobUserAccountId)).toBeNull();
    expect(warn).toHaveBeenCalledWith('[chat-request-v2] inner signature invalid');
  });
});

describe('chatRequestGateway.sendChatRequestCancel', () => {
  function makeCancelFixture(store: StatementStoreAdapter) {
    const aliceDevice = makeDevice(0x07);
    const aliceUserChat = makeUserChatKey();
    const bobUserChat = makeUserChatKey();

    const cancelParams = (request: { requestId: string; channelTopic: Uint8Array }, requestTimestamp: number) => ({
      requestId: request.requestId,
      requestTimestamp,
      channelTopic: request.channelTopic,
      recipientAccountId: bobUserAccountId,
      recipientChatPubKey: bobUserChat.pub,
      senderIdentityAccountId: aliceUserAccountId,
      senderIdentityChatPrivateKey: aliceUserChat.priv,
      senderDeviceSeed: aliceDevice.seed,
      statementStore: store,
    });

    const sendRequest = () =>
      chatRequestGateway.sendChatRequestV2({
        recipientAccountId: bobUserAccountId,
        recipientChatPubKey: bobUserChat.pub,
        senderIdentityAccountId: aliceUserAccountId,
        senderIdentityChatPrivateKey: aliceUserChat.priv,
        senderDevicePubKey: aliceDevice.encPub,
        senderDeviceSeed: aliceDevice.seed,
        statementStore: store,
      });

    return { aliceUserChat, bobUserChat, cancelParams, sendRequest };
  }

  it('replaces the request on its channel with a cancel the receiver decodes', async () => {
    const store = createInMemoryStatementStore();
    const { aliceUserChat, bobUserChat, cancelParams, sendRequest } = makeCancelFixture(store);
    const request = await sendRequest();

    const result = await chatRequestGateway.sendChatRequestCancel(cancelParams(request, Date.now()));

    expect(result).toBe('published');
    const onChannel = store.currentStatements().filter(s => s.channel === toHex(request.channelTopic));
    expect(onChannel).toHaveLength(1);
    const decoded = chatRequestGateway.decryptAndValidateRequestV2(onChannel[0]!.data!, bobUserChat.priv, bobUserAccountId);
    expect(decoded?.tag).toBe('cancel');
    if (decoded?.tag !== 'cancel') return;
    expect(decoded.value.requestId).toBe(request.requestId);
    expect(
      chatRequestService.isCancelProofValid(
        p2pService.computeSharedSecret(bobUserChat.priv, aliceUserChat.pub),
        { identityAccountId: decoded.value.senderIdentityAccountId, proof: decoded.value.identityProof },
        request.requestId,
      ),
    ).toBe(true);
  });

  it('publishes nothing when no own copy is on the channel', async () => {
    const store = createInMemoryStatementStore();
    const { cancelParams } = makeCancelFixture(store);

    const result = await chatRequestGateway.sendChatRequestCancel(
      cancelParams({ requestId: 'req-1', channelTopic: new Uint8Array(32).fill(0xd4) }, Date.now()),
    );

    expect(result).toBe('noCopy');
    expect(store.acceptedStatements()).toEqual([]);
  });

  it("publishes nothing when only another account's statement is on the channel", async () => {
    const store = createInMemoryStatementStore();
    const { bobUserChat, cancelParams } = makeCancelFixture(store);
    const otherDevice = makeDevice(0x08);
    const foreignRequest = await chatRequestGateway.sendChatRequestV2({
      recipientAccountId: bobUserAccountId,
      recipientChatPubKey: bobUserChat.pub,
      senderIdentityAccountId: aliceUserAccountId,
      senderIdentityChatPrivateKey: makeUserChatKey().priv,
      senderDevicePubKey: otherDevice.encPub,
      senderDeviceSeed: otherDevice.seed,
      statementStore: store,
    });
    const before = store.currentStatements();

    const result = await chatRequestGateway.sendChatRequestCancel(cancelParams(foreignRequest, Date.now()));

    expect(result).toBe('noCopy');
    expect(store.acceptedStatements()).toHaveLength(1);
    expect(store.currentStatements()).toEqual(before);
  });

  it('rejects when the query fails', async () => {
    const { adapter } = captureSubmittedData();
    vi.mocked(adapter.queryStatements).mockReturnValue(errAsync(new Error('down')));
    const { cancelParams } = makeCancelFixture(adapter);

    await expect(
      chatRequestGateway.sendChatRequestCancel(
        cancelParams({ requestId: 'req-1', channelTopic: new Uint8Array(32).fill(0xd4) }, Date.now()),
      ),
    ).rejects.toThrow('down');
    expect(adapter.submitStatement).not.toHaveBeenCalled();
  });

  it('stamps the cancel later than the request', async () => {
    const store = createInMemoryStatementStore();
    const { bobUserChat, cancelParams, sendRequest } = makeCancelFixture(store);
    const request = await sendRequest();
    const requestTimestamp = Date.now() + 60_000;

    await chatRequestGateway.sendChatRequestCancel(cancelParams(request, requestTimestamp));

    const onChannel = store.currentStatements().filter(s => s.channel === toHex(request.channelTopic));
    const decoded = chatRequestGateway.decryptAndValidateRequestV2(onChannel[0]!.data!, bobUserChat.priv, bobUserAccountId);
    expect(decoded?.tag).toBe('cancel');
    if (decoded?.tag !== 'cancel') return;
    expect(decoded.value.timestamp).toBeGreaterThan(requestTimestamp);
  });
});
