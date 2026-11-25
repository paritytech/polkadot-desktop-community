import { x25519 } from '@noble/curves/ed25519.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { ChatMessage as ChatMessageCodec } from '@novasamatech/host-chat/codec/message';
import { Bytes } from '@novasamatech/scale';
import {
  type PeerRoster,
  createAccountId,
  createInMemoryStatementStore,
  createMultiDeviceSession,
  createSr25519Prover,
  createSr25519Secret,
  deriveSlotAccountPublicKey,
  ensureSubstrateSlotSr25519Ready,
} from '@novasamatech/statement-store';
import { substrateSlotSecretFromSeedBytes } from '@novasamatech/substrate-slot-sr25519-wasm';
import { toHex } from 'polkadot-api/utils';
import { type CodecType } from 'scale-ts';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { createChatPeerSessionV2 } from './chatSessionV2';

beforeAll(ensureSubstrateSlotSr25519Ready);

/**
 * Covers the three things this adapter decides on its own; everything else is the SDK's.
 *
 *  - what we ACK (a blanket 'success' would tell the peer we received a message this
 *    build dropped),
 *  - how a batch-level response reaches messages restored from a previous run, whose
 *    delivery tokens the SDK cannot restore,
 *  - which account signs our statements (the statement account the canonical secret names, not the
 *    different account the same bytes yield under the ed25519-expanded encoding).
 *
 * All three are decisions the PEER reads off the wire, so they are exercised over the SDK's
 * own in-memory statement store with a real peer session on the other end: the ack is
 * asserted where it actually lands — on the response statement — rather than at the
 * handler's return value.
 */

const rawCodec = Bytes();

/** One turn of the store's synchronous delivery plus the session's own async hops. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

function createDevice(statementAccountId: Uint8Array = randomBytes(32)) {
  const encryptionPrivateKey = x25519.utils.randomSecretKey();

  return {
    statementAccountId,
    encryptionPrivateKey,
    encryptionPublicKey: x25519.getPublicKey(encryptionPrivateKey),
  };
}

function createIdentity() {
  const chatPrivateKey = x25519.utils.randomSecretKey();

  return {
    accountId: randomBytes(32),
    chatPrivateKey,
    chatPublicKey: x25519.getPublicKey(chatPrivateKey),
  };
}

const rosterOf = (device: ReturnType<typeof createDevice>): PeerRoster => ({
  current: () => [{ statementAccountId: device.statementAccountId, encryptionPublicKey: device.encryptionPublicKey }],
  subscribe: () => () => {},
});

const chatMessage = (messageId: string, text: string) => ({
  messageId,
  timestamp: 1_700_000_000_000n,
  versioned: { tag: 'v1' as const, value: { tag: 'text' as const, value: text } },
});

/**
 * The adapter under test and a bare SDK session as its peer, over one shared store.
 *
 * The peer signs for real: the session driver verifies every incoming statement's proof
 * with the local prover, so a stubbed signature is dropped before it reaches a handler.
 */
function createPair() {
  const store = createInMemoryStatementStore();
  const host = createIdentity();
  const peer = createIdentity();
  const hostSecret = substrateSlotSecretFromSeedBytes(randomBytes(32));
  const hostDevice = createDevice(deriveSlotAccountPublicKey(hostSecret));
  const peerDevice = createDevice();

  const onMessage = vi.fn();
  const onDelivered = vi.fn();
  const onSent = vi.fn();
  const onBatchDelivered = vi.fn();

  const hostSession = createChatPeerSessionV2({
    identityChatPrivateKey: host.chatPrivateKey,
    ownIdentityAccountId: host.accountId,
    ownDeviceStatementAccountId: hostDevice.statementAccountId,
    ownDeviceEncryptionPrivateKey: hostDevice.encryptionPrivateKey,
    ownDeviceSeed: hostSecret,
    peerIdentityAccountId: peer.accountId,
    peerIdentityChatPublicKey: peer.chatPublicKey,
    peerRoster: rosterOf(peerDevice),
    statementStore: store,
    onMessage,
    onDelivered,
    onSent,
    onBatchDelivered,
  });

  const peerSession = createMultiDeviceSession({
    localDevice: { statementAccountId: peerDevice.statementAccountId, encryptionPrivateKey: peerDevice.encryptionPrivateKey },
    localIdentity: { accountId: createAccountId(peer.accountId), chatPrivateKey: peer.chatPrivateKey },
    remoteIdentity: { accountId: createAccountId(host.accountId), chatPublicKey: host.chatPublicKey },
    peerRoster: rosterOf(hostDevice),
    statementStore: store,
    prover: createSr25519Prover(createSr25519Secret(randomBytes(32))),
  });

  const dispose = () => {
    hostSession.dispose();
    peerSession.dispose();
  };

  return { store, hostDevice, hostSession, peerSession, onMessage, onDelivered, onSent, onBatchDelivered, dispose };
}

/**
 * The host side of `createPair` with the peer offline until `bringPeerOnline()`. The SDK's
 * in-memory store does not replay a channel to a session that subscribes later, so a peer
 * created up front would never see what replaced a message it was already sent.
 */
function createHostOnly() {
  const store = createInMemoryStatementStore();
  const host = createIdentity();
  const peer = createIdentity();
  const hostSecret = substrateSlotSecretFromSeedBytes(randomBytes(32));
  const hostDevice = createDevice(deriveSlotAccountPublicKey(hostSecret));
  const peerDevice = createDevice();

  const onMessage = vi.fn();
  const onDelivered = vi.fn();
  const onSent = vi.fn();
  const onBatchDelivered = vi.fn();

  const hostSession = createChatPeerSessionV2({
    identityChatPrivateKey: host.chatPrivateKey,
    ownIdentityAccountId: host.accountId,
    ownDeviceStatementAccountId: hostDevice.statementAccountId,
    ownDeviceEncryptionPrivateKey: hostDevice.encryptionPrivateKey,
    ownDeviceSeed: hostSecret,
    peerIdentityAccountId: peer.accountId,
    peerIdentityChatPublicKey: peer.chatPublicKey,
    peerRoster: rosterOf(peerDevice),
    statementStore: store,
    onMessage,
    onDelivered,
    onSent,
    onBatchDelivered,
  });

  function bringPeerOnline() {
    const received: CodecType<typeof ChatMessageCodec>[] = [];
    const peerSession = createMultiDeviceSession({
      localDevice: { statementAccountId: peerDevice.statementAccountId, encryptionPrivateKey: peerDevice.encryptionPrivateKey },
      localIdentity: { accountId: createAccountId(peer.accountId), chatPrivateKey: peer.chatPrivateKey },
      remoteIdentity: { accountId: createAccountId(host.accountId), chatPublicKey: host.chatPublicKey },
      peerRoster: rosterOf(hostDevice),
      statementStore: store,
      prover: createSr25519Prover(createSr25519Secret(randomBytes(32))),
    });
    peerSession.respondToRequests(ChatMessageCodec, request => {
      if (request.payload.status === 'parsed') received.push(request.payload.value);

      return 'success';
    });

    return { received, dispose: () => peerSession.dispose() };
  }

  return { hostSession, onMessage, onDelivered, onSent, onBatchDelivered, bringPeerOnline };
}

describe('createChatPeerSessionV2 — acknowledgement', () => {
  it('acks a request it could decode', async () => {
    const { peerSession, onMessage, dispose } = createPair();
    await settle();

    // A session only opens its store subscription once something subscribes, so the peer
    // must be subscribed or the host's ACK never reaches it.
    peerSession.subscribe(ChatMessageCodec, vi.fn());
    const submitted = await peerSession.submitRequestMessage(ChatMessageCodec, chatMessage('m1', 'hello host'));
    const response = await peerSession.waitForResponseMessage(submitted._unsafeUnwrap().requestId);

    expect(response._unsafeUnwrap().responseCode).toBe('success');
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: 'm1', content: { tag: 'text', value: 'hello host' } }),
    );

    dispose();
  });

  it('does NOT ack a request it could not decode', async () => {
    const { peerSession, onMessage, dispose } = createPair();
    await settle();

    peerSession.subscribe(rawCodec, vi.fn());
    // Bytes the chat codec cannot read — what a message from a build this one predates
    // looks like on the wire. A blanket 'success' here would advance the peer's message
    // to ✓✓ for something this build dropped.
    const submitted = await peerSession.submitRequestMessage(rawCodec, new Uint8Array([0xff, 0xff, 0xff]));
    const response = await peerSession.waitForResponseMessage(submitted._unsafeUnwrap().requestId);

    expect(response._unsafeUnwrap().responseCode).toBe('decodingFailed');
    expect(onMessage).not.toHaveBeenCalled();

    dispose();
  });
});

describe('createChatPeerSessionV2 — batch delivery', () => {
  it('reports a batch ack, which is the only delivery signal a restored message gets', async () => {
    const { hostSession, peerSession, onBatchDelivered, dispose } = createPair();
    await settle();

    peerSession.respondToRequests(ChatMessageCodec, () => 'success');
    await hostSession.send({ tag: 'text', value: 'hello peer' });
    await settle();

    expect(onBatchDelivered).toHaveBeenCalled();

    dispose();
  });

  it('ignores a non-success response', async () => {
    const { hostSession, peerSession, onBatchDelivered, dispose } = createPair();
    await settle();

    peerSession.respondToRequests(ChatMessageCodec, () => 'decodingFailed');
    await hostSession.send({ tag: 'text', value: 'hello peer' });
    await settle();

    expect(onBatchDelivered).not.toHaveBeenCalled();

    dispose();
  });
});

describe('createChatPeerSessionV2 — statement signer', () => {
  it('signs its statements as its statement account', async () => {
    const { store, hostDevice, hostSession, peerSession, dispose } = createPair();
    await settle();

    peerSession.respondToRequests(ChatMessageCodec, () => 'success');
    await hostSession.send({ tag: 'text', value: 'hello peer' });
    await settle();

    const signers = store
      .acceptedStatements()
      .map(statement => (statement.proof && 'signer' in statement.proof.value ? statement.proof.value.signer : null));
    expect(signers).toContain(toHex(hostDevice.statementAccountId));

    dispose();
  });
});

describe('createChatPeerSessionV2 — seen receipts', () => {
  it('resolves delivered when the peer answers, and reports no sent message', async () => {
    const { hostSession, peerSession, onSent, onDelivered, dispose } = createPair();
    await settle();

    const received: CodecType<typeof ChatMessageCodec>[] = [];
    peerSession.respondToRequests(ChatMessageCodec, request => {
      if (request.payload.status === 'parsed') received.push(request.payload.value);

      return 'success';
    });

    await expect(hostSession.sendSeen({ messageId: 'm-9', timestamp: 1_700_000_000_123 })).resolves.toBe('delivered');
    expect(received.map(message => message.versioned.value)).toEqual([
      { tag: 'seen', value: { messageId: 'm-9', timestamp: 1_700_000_000_123n } },
    ]);
    expect(onSent).not.toHaveBeenCalled();
    expect(onDelivered).not.toHaveBeenCalled();

    dispose();
  });

  it('resolves failed when the peer cannot decode the receipt', async () => {
    const { hostSession, peerSession, dispose } = createPair();
    await settle();

    peerSession.respondToRequests(ChatMessageCodec, () => 'decodingFailed');

    await expect(hostSession.sendSeen({ messageId: 'm-9', timestamp: 1_700_000_000_123 })).resolves.toBe('failed');

    dispose();
  });

  it('replaces a receipt the peer has not answered yet', async () => {
    const { hostSession, bringPeerOnline } = createHostOnly();
    await settle();

    // The SDK rejects and forgets a replaced waiter at submit, so the first receipt's waiter
    // must exist before the second one is submitted.
    const first = hostSession.sendSeen({ messageId: 'm-1', timestamp: 1 });
    await settle();
    const second = hostSession.sendSeen({ messageId: 'm-2', timestamp: 2 });
    await settle();

    await expect(first).resolves.toBe('replaced');

    const peer = bringPeerOnline();

    await expect(second).resolves.toBe('delivered');
    expect(peer.received.map(message => message.versioned.value)).toEqual([
      { tag: 'seen', value: { messageId: 'm-2', timestamp: 2n } },
    ]);

    hostSession.dispose();
    peer.dispose();
  });
});
