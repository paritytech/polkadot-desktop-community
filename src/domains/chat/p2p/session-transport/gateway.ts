/**
 * Statement-store wire transport for P2P chat.
 *
 * Every submit here rides the app-policy `signAndSubmitStatement`
 * (`@/domains/application`), which owns expiry allocation (so same-second
 * submits never tie on priority) and the AccountFull / ExpiryTooLow retry.
 *
 * ── Identity-level transport ─────────────────────────────────────────────
 * Publish/subscribe on `SessionId(A,B)` keyed by
 * `K(A,B) = ECDH(identityChatPriv, peerIdentityChatPub)`.
 *
 * Spec v0.1 routes a few chat-content variants through this identity-level
 * channel rather than the per-device session topic:
 *
 *   - `deviceChatAccepted` (MessageContent index 20, per chat spec v0.1).
 *     Sent by the acceptor B on accept of A's chat request.
 *   - `deviceAdded` (index 17) / `deviceRemoved` (index 18). Sent by a peer's
 *     PApp when their device roster changes, fanned out to all contacts.
 *
 * Identity-level transport is required for these because they carry information
 * the receiver needs to bootstrap per-device transport (peer's `DeviceInfo`);
 * the per-device transport can't be used yet — circular dependency.
 *
 * On the wire each event arrives as a SCALE-encoded
 * `StructuredStatementData::Request { requestId, messages: [ChatMessage] }`
 * encrypted with `K(A,B)`, with the inner `ChatMessage.content` carrying the
 * variant. We also accept a legacy Android `StructuredStatementData::MultiRequest`
 * shape where the "device" is identity-conflated (recipient's identity sr25519
 * in the device slot, identity chat keypair playing the role of device enc
 * keypair) — that path will go away once Android emits the spec shape.
 */

import { type Statement } from '@novasamatech/sdk-statement';
import {
  type StatementStoreAdapter,
  createAccountId,
  createEncryption,
  createSessionId,
  khash,
} from '@novasamatech/statement-store';
import { nanoid } from 'nanoid';
import { toHex } from 'polkadot-api/utils';
import { type CodecType } from 'scale-ts';

import { signAndSubmitStatement } from '@/domains/application';
import { multiDeviceService } from '../multi-device/service';
import { MultiChatAccepted, SingleRequest, StructuredStatementData } from '../requests/schemas';
import { p2pService } from '../service';
import { trackedSubscribeStatements } from '../subscription-registry';

import { ChatMessage as ChatMessageCodec } from './schemas';
import { type AcceptSignal, type IdentityChannelEvent } from './types';

// ── Identity / device channel routing ────────────────────────────────────

const REQUEST_LABEL = new TextEncoder().encode('request');
const RESPONSE_LABEL = new TextEncoder().encode('response');

type IdentityRoute = {
  ownIdentityChatPrivateKey: Uint8Array;
  ownIdentityAccountId: Uint8Array;
  peerIdentityChatPublicKey: Uint8Array;
  peerIdentityAccountId: Uint8Array;
  // Device sr25519 — used as the MultiRequest slot key when Android wraps the
  // accept signal per-device (the slot is keyed on the recipient device's
  // sr25519, NOT the user identity sr25519).
  ownDeviceStatementAccountId: Uint8Array;
  // Device encryption priv (P-256) — used to ECDH against the sender's
  // identity chat pub when unwrapping the per-slot one-shot key. Android
  // wraps with ECDH(android.identityChatPriv × ourDeviceEncPub), so our
  // matching unwrap pair is (ourDeviceEncPriv × android.identityChatPub).
  ownDeviceEncryptionPrivateKey: Uint8Array;
};

const computeRoute = (
  keys: IdentityRoute,
  direction: 'outgoing' | 'incoming',
): { topic: Uint8Array; sharedSecret: Uint8Array } => {
  const sharedSecret = p2pService.computeSharedSecret(keys.ownIdentityChatPrivateKey, keys.peerIdentityChatPublicKey);
  const localAcct = { accountId: createAccountId(keys.ownIdentityAccountId), pin: undefined };
  const remoteAcct = { accountId: createAccountId(keys.peerIdentityAccountId), pin: undefined };
  // From our perspective: outgoing has us as "from", peer as "to"; incoming has
  // peer as "from", us as "to". Both peers compute the same bytes for their
  // matching direction.
  const topic =
    direction === 'outgoing'
      ? createSessionId(sharedSecret, localAcct, remoteAcct)
      : createSessionId(sharedSecret, remoteAcct, localAcct);
  return { topic, sharedSecret };
};

type DeviceRoute = {
  ownIdentityChatPrivateKey: Uint8Array;
  peerIdentityAccountId: Uint8Array;
  peerIdentityChatPublicKey: Uint8Array;
  peerDeviceEncryptionPublicKey: Uint8Array;
  ownDeviceStatementAccountId: Uint8Array;
  ownDeviceEncryptionPrivateKey: Uint8Array;
};

/**
 * Per-peer-device "main" channel — matches `chatSessionV2.ts` outgoing
 * topic derivation (which is also what mobile expects on receive):
 *   topic = SessionId(D(A), B) = createSessionId(K(D(A),B), localDevice, remoteIdentity)
 * where:
 * - localDevice  = ownDeviceStatementAccountId
 * - remoteIdentity = peerIdentityAccountId
 * - K(D(A),B)  = ECDH(ownDeviceEncryptionPrivateKey, peerIdentityChatPublicKey)
 *
 * Used for steady-state fanout (deviceAdded/deviceRemoved) AFTER bootstrap
 * deviceChatAccepted on the identity-channel has established device knowledge
 * on both sides. Mobile subscribes on the same per-peer-device topic for both
 * regular chat traffic and roster updates — Android via
 * `communicationSessions.main`, iOS via `makePeerSubscription`. Posting roster
 * updates on this same topic means mobile already listens there.
 */
const computeDeviceRoute = (
  keys: DeviceRoute,
  direction: 'outgoing' | 'incoming',
): { topic: Uint8Array; sharedSecret: Uint8Array } => {
  const sharedSecret =
    direction === 'outgoing'
      ? p2pService.computeSharedSecret(keys.ownDeviceEncryptionPrivateKey, keys.peerIdentityChatPublicKey)
      : p2pService.computeSharedSecret(keys.ownIdentityChatPrivateKey, keys.peerDeviceEncryptionPublicKey);
  const localDevice = { accountId: createAccountId(keys.ownDeviceStatementAccountId), pin: undefined };
  const remoteIdentity = { accountId: createAccountId(keys.peerIdentityAccountId), pin: undefined };
  const topic =
    direction === 'outgoing'
      ? createSessionId(sharedSecret, localDevice, remoteIdentity)
      : createSessionId(sharedSecret, remoteIdentity, localDevice);
  return { topic, sharedSecret };
};

// ── Event surface (types in ./types) ────────────────────────────────────

// ── Send: ChatMessage(content) on identity-level topic ──────────────────

/**
 * Publish a `ChatMessage` whose content is one of the identity-level variants
 * (`deviceChatAccepted`, `deviceAdded`, `deviceRemoved`, …) on `SessionId(A,B)`
 * with outer encryption `K(A,B)`. Statement is signed with the caller's device
 * sr25519; the receiver doesn't verify the signer identity here — trust comes
 * from being able to compute K(A,B) (only A and B's identities can).
 */
async function postChatMessageOnIdentityChannel(
  params: IdentityRoute & {
    signerDeviceSeed: Uint8Array;
    statementStore: StatementStoreAdapter;
    chatMessageContent: CodecType<typeof ChatMessageCodec>['versioned']['value'];
  },
): Promise<void> {
  const { signerDeviceSeed, statementStore, chatMessageContent, ...keys } = params;

  const chatMsgBytes = ChatMessageCodec.enc({
    messageId: nanoid(12),
    timestamp: BigInt(Date.now()),
    versioned: { tag: 'v1', value: chatMessageContent },
  });

  const payload = StructuredStatementData.enc({
    tag: 'Request',
    value: { requestId: nanoid(), messages: [chatMsgBytes] },
  });

  const { topic, sharedSecret } = computeRoute(keys, 'outgoing');
  const channel = khash(topic, REQUEST_LABEL);

  const carriedDevice: { statementAccountId?: Uint8Array; encryptionPublicKey?: Uint8Array } | null =
    chatMessageContent.tag === 'deviceChatAccepted'
      ? chatMessageContent.value.device
      : chatMessageContent.tag === 'deviceAdded'
        ? chatMessageContent.value
        : chatMessageContent.tag === 'deviceRemoved'
          ? { statementAccountId: chatMessageContent.value.statementAccountId }
          : null;
  console.info(
    '[DEVICE-TRACE] postChatMessageOnIdentityChannel:\n  topic=%s\n  contentTag=%s\n  carrying device.stmtAcct=%s\n  carrying device.encPub=%s\n  ownIdentityAcct=%s\n  peerIdentityAcct=%s\n  ownDevice=%s',
    toHex(topic),
    chatMessageContent.tag,
    carriedDevice?.statementAccountId ? toHex(carriedDevice.statementAccountId) : '(n/a)',
    carriedDevice?.encryptionPublicKey ? toHex(carriedDevice.encryptionPublicKey) : '(n/a)',
    toHex(keys.ownIdentityAccountId),
    toHex(keys.peerIdentityAccountId),
    toHex(keys.ownDeviceStatementAccountId),
  );
  console.info(
    '[identity-channel] OUT posting to topic=%s\n  contentTag=%s\n  ownIdentityAcct=%s\n  peerIdentityAcct=%s\n  peerChatPub=%s\n  ownDevice=%s\n  sharedSecret=%s (DEBUG ONLY — sensitive)\n  direction=outgoing (createSessionId(shared, ours, peer))',
    toHex(topic),
    chatMessageContent.tag,
    toHex(keys.ownIdentityAccountId),
    toHex(keys.peerIdentityAccountId),
    toHex(keys.peerIdentityChatPublicKey),
    toHex(keys.ownDeviceStatementAccountId),
    toHex(sharedSecret),
  );

  const encryption = createEncryption(sharedSecret);
  const encryptResult = encryption.encrypt(payload);
  if (encryptResult.isErr()) throw encryptResult.error;

  await signAndSubmitStatement({
    signerSeed: signerDeviceSeed,
    statementStore,
    channel,
    topics: topic,
    data: encryptResult.value,
    logTag: 'identity-channel send',
  });
}

/**
 * Per-peer-device "main" channel send — counterpart of `postChatMessageOnIdentityChannel`
 * but on the device-derived topic. Use for steady-state content (`deviceAdded`,
 * `deviceRemoved`) after bootstrap — matches mobile's `communicationSessions.main`
 * (Android) / per-peer-device subscription (iOS).
 *
 * Wire is identical (StructuredStatementData::Request → ChatMessage), only the
 * outer envelope's ECDH key + topic differ.
 */
async function postChatMessageOnDeviceChannel(
  params: DeviceRoute & {
    signerDeviceSeed: Uint8Array;
    statementStore: StatementStoreAdapter;
    chatMessageContent: CodecType<typeof ChatMessageCodec>['versioned']['value'];
  },
): Promise<void> {
  const { signerDeviceSeed, statementStore, chatMessageContent, ...keys } = params;

  const chatMsgBytes = ChatMessageCodec.enc({
    messageId: nanoid(12),
    timestamp: BigInt(Date.now()),
    versioned: { tag: 'v1', value: chatMessageContent },
  });

  const payload = StructuredStatementData.enc({
    tag: 'Request',
    value: { requestId: nanoid(), messages: [chatMsgBytes] },
  });

  const { topic, sharedSecret } = computeDeviceRoute(keys, 'outgoing');
  const channel = khash(topic, REQUEST_LABEL);

  const carriedDevice: { statementAccountId?: Uint8Array; encryptionPublicKey?: Uint8Array } | null =
    chatMessageContent.tag === 'deviceChatAccepted'
      ? chatMessageContent.value.device
      : chatMessageContent.tag === 'deviceAdded'
        ? chatMessageContent.value
        : chatMessageContent.tag === 'deviceRemoved'
          ? { statementAccountId: chatMessageContent.value.statementAccountId }
          : null;
  console.info(
    '[DEVICE-TRACE] postChatMessageOnDeviceChannel:\n  topic=%s (should equal chat-session-v2 SEND topic)\n  contentTag=%s\n  carrying device.stmtAcct=%s\n  carrying device.encPub=%s\n  ownDevice=%s\n  peerIdentityAcct=%s',
    toHex(topic),
    chatMessageContent.tag,
    carriedDevice?.statementAccountId ? toHex(carriedDevice.statementAccountId) : '(n/a)',
    carriedDevice?.encryptionPublicKey ? toHex(carriedDevice.encryptionPublicKey) : '(n/a)',
    toHex(keys.ownDeviceStatementAccountId),
    toHex(keys.peerIdentityAccountId),
  );
  console.info(
    '[device-channel] OUT posting to topic=%s\n  contentTag=%s\n  ownDevice=%s\n  peerIdentityAcct=%s\n  peerChatPub=%s\n  sharedSecret=%s (DEBUG ONLY — sensitive)\n  direction=outgoing (createSessionId(shared, ownDevice, peerIdentity))',
    toHex(topic),
    chatMessageContent.tag,
    toHex(keys.ownDeviceStatementAccountId),
    toHex(keys.peerIdentityAccountId),
    toHex(keys.peerIdentityChatPublicKey),
    toHex(sharedSecret),
  );

  const encryption = createEncryption(sharedSecret);
  const encryptResult = encryption.encrypt(payload);
  if (encryptResult.isErr()) throw encryptResult.error;

  await signAndSubmitStatement({
    signerSeed: signerDeviceSeed,
    statementStore,
    channel,
    topics: topic,
    data: encryptResult.value,
    logTag: 'device-channel send',
  });
}

// ── Legacy desktop-as-acceptor path ─────────────────────────────────────
// `postAcceptSignalV2` posts an opaque payload (typically a `MultiChatAccepted`)
// on the identity-level topic. Kept for backward-compat with code paths that
// haven't migrated to `postChatMessageOnIdentityChannel` yet.

function encodeMultiChatAccepted(params: {
  requestId: string;
  acceptorDevices: { statementAccountId: Uint8Array; encryptionPublicKey: Uint8Array }[];
}): Uint8Array {
  return MultiChatAccepted.enc(params);
}

async function postAcceptSignalV2(
  params: IdentityRoute & {
    signerDeviceSeed: Uint8Array;
    payload: Uint8Array;
    statementStore: StatementStoreAdapter;
  },
): Promise<void> {
  const { signerDeviceSeed, payload, statementStore, ...keys } = params;
  const { topic, sharedSecret } = computeRoute(keys, 'outgoing');
  const channel = khash(topic, REQUEST_LABEL);

  const encryption = createEncryption(sharedSecret);
  const encryptResult = encryption.encrypt(payload);
  if (encryptResult.isErr()) throw encryptResult.error;

  await signAndSubmitStatement({
    signerSeed: signerDeviceSeed,
    statementStore,
    channel,
    topics: topic,
    data: encryptResult.value,
    logTag: 'acceptSignalV2',
  });

  void RESPONSE_LABEL;
}

// ── Receive: long-running identity-channel listener ─────────────────────

function decodeEventsFromChatMessage(msgBytes: Uint8Array): IdentityChannelEvent[] {
  let msg: ReturnType<typeof ChatMessageCodec.dec>;
  try {
    msg = ChatMessageCodec.dec(msgBytes);
  } catch (e) {
    console.warn('[identity-channel] ChatMessage decode failed: %s', String(e));
    return [];
  }
  const acceptedAt = Number(msg.timestamp);
  const content = msg.versioned.value;
  if (content.tag === 'deviceChatAccepted') {
    return [
      {
        tag: 'acceptSignal',
        signal: { requestId: content.value.requestId, acceptorDevice: content.value.device, acceptedAt },
      },
    ];
  }
  if (content.tag === 'chatAccepted') {
    // Android-legacy single-device accept (index 14, no DeviceInfo on the wire).
    // Dropped intentionally: accepting it would force the matcher into the
    // identity-conflated fallback (synthetic device keyed by peer's identity
    // sr25519), which makes the peer unable to decrypt subsequent V2 sends
    // (bug #9, blocked-on-Android). Better to leave the local outgoing
    // request visibly stuck on 'pending' than to flip it to 'accepted' and
    // then silently drop every message until Android emits @20.
    console.warn(
      '[identity-channel] dropping Android-legacy chatAccepted @14 (requestId=%s) — peer must emit deviceChatAccepted @20',
      content.value.messageId,
    );
    return [];
  }
  if (content.tag === 'deviceAdded') {
    return [
      {
        tag: 'deviceAdded',
        statementAccountId: content.value.statementAccountId,
        encryptionPublicKey: content.value.encryptionPublicKey,
      },
    ];
  }
  if (content.tag === 'deviceRemoved') {
    return [{ tag: 'deviceRemoved', statementAccountId: content.value.statementAccountId }];
  }
  return [];
}

const decodeIdentityChannelEvents = (
  outerPlaintext: Uint8Array,
  _ownIdentityAccountId: Uint8Array,
  _ownIdentityChatPrivateKey: Uint8Array,
  peerIdentityChatPublicKey: Uint8Array,
  ownDeviceStatementAccountId: Uint8Array,
  ownDeviceEncryptionPrivateKey: Uint8Array,
): IdentityChannelEvent[] => {
  let outer: ReturnType<typeof StructuredStatementData.dec>;
  try {
    outer = StructuredStatementData.dec(outerPlaintext);
  } catch (e) {
    console.warn('[identity-channel] outer decode failed: %s', String(e));
    return [];
  }

  let messages: Uint8Array[] = [];

  if (outer.tag === 'Request') {
    // Spec / iOS path: bare identity-level transport.
    messages = outer.value.messages;
  } else if (outer.tag === 'MultiRequest') {
    // Slot keyed on the recipient device's sr25519 (`ownDeviceStatementAccountId`).
    // Wrap key is ECDH(ownIdentityChatPrivateKey, peerIdentityChatPublicKey) —
    // the "identity-conflated" wrap: identity chat keypair plays the role of
    // the device encryption keypair for the per-slot wrap.
    const unwrapped = multiDeviceService.decryptForOwnDevice(
      outerPlaintext,
      ownDeviceStatementAccountId,
      ownDeviceEncryptionPrivateKey,
      peerIdentityChatPublicKey,
    );
    if (!unwrapped) {
      console.warn(
        '[identity-channel] MultiRequest unwrap failed (slot/key mismatch) ownDevice=%s peerChatPub=%s',
        toHex(ownDeviceStatementAccountId),
        toHex(peerIdentityChatPublicKey),
      );
      return [];
    }
    try {
      messages = SingleRequest.dec(unwrapped).messages;
    } catch (e) {
      console.warn('[identity-channel] SingleRequest decode failed: %s', String(e));
      return [];
    }
  } else {
    console.warn('[identity-channel] unknown outer tag = %s', outer.tag);
    return [];
  }

  const events: IdentityChannelEvent[] = [];
  for (const msgBytes of messages) {
    events.push(...decodeEventsFromChatMessage(msgBytes));
  }
  return events;
};

/**
 * Long-running subscription on the identity-level topic with the peer. Surfaces
 * accept signals, device adds, and device removes as a stream of events.
 *
 * Does NOT auto-unsubscribe on any event — the caller manages lifecycle via the
 * returned `VoidFunction`. The same subscription serves both bootstrap concerns
 * (chat-request accept matching) and steady-state concerns (roster updates).
 */
function subscribeToIdentityChannelV2(
  params: IdentityRoute & { statementStore: StatementStoreAdapter },
  callback: (event: IdentityChannelEvent) => void,
): VoidFunction {
  const { statementStore, ...keys } = params;
  const { topic, sharedSecret } = computeRoute(keys, 'incoming');
  const encryption = createEncryption(sharedSecret);

  // DEBUG ONLY: logs the raw ECDH sharedSecret. Authorized by user for
  // cross-platform topic-derivation comparison with Android. The secret
  // protects all identity-channel traffic between A and B — anyone with
  // this hex + the encrypted wire bytes can read every identity-channel
  // message. Do not enable in production builds. Do not paste the Console
  // dump containing this line outside a trusted channel.
  console.info(
    '[identity-channel] subscribing topic=%s\n  ownIdentityAcct=%s\n  peerIdentityAcct=%s\n  peerChatPub=%s\n  ownDevice=%s\n  sharedSecret=%s (DEBUG ONLY — sensitive)\n  direction=incoming (createSessionId(shared, peer, ours))',
    toHex(topic),
    toHex(params.ownIdentityAccountId),
    toHex(params.peerIdentityAccountId),
    toHex(params.peerIdentityChatPublicKey),
    toHex(params.ownDeviceStatementAccountId),
    toHex(sharedSecret),
  );

  const handleStatements = (statements: Statement[]) => {
    for (const stmt of statements) {
      if (!stmt.data) continue;
      const decryptResult = encryption.decrypt(stmt.data);
      if (decryptResult.isErr()) {
        console.warn('[identity-channel] outer decrypt failed: %s', String(decryptResult.error));
        continue;
      }
      const events = decodeIdentityChannelEvents(
        decryptResult.value,
        keys.ownIdentityAccountId,
        keys.ownIdentityChatPrivateKey,
        keys.peerIdentityChatPublicKey,
        keys.ownDeviceStatementAccountId,
        keys.ownDeviceEncryptionPrivateKey,
      );
      for (const event of events) callback(event);
    }
  };

  const unsub = trackedSubscribeStatements(statementStore, { matchAll: [topic] }, ({ statements }) => {
    if (statements.length > 0) {
      console.info('[identity-channel] received %d statement(s) on topic=%s', statements.length, toHex(topic));
    }
    handleStatements(statements);
  });

  // subscribeStatements only delivers statements that arrive after it goes live,
  // so a one-shot accept published before/around subscribe is missed and never
  // recovered. Catch up on history once so receipt doesn't hinge on subscribe timing.
  void statementStore
    .queryStatements({ matchAll: [topic] })
    .match(handleStatements, err => console.warn('[identity-channel] queryStatements catch-up failed: %s', String(err)));

  return unsub;
}

/**
 * Backward-compat: surface only accept signals via the legacy callback shape.
 * Lifecycle still managed by the caller — unsubscribe when the matching
 * request resolves, or keep the listener alive for future roster events.
 */
function subscribeToAcceptSignalV2(
  params: IdentityRoute & { statementStore: StatementStoreAdapter },
  callback: (signal: AcceptSignal) => void,
): VoidFunction {
  return subscribeToIdentityChannelV2(params, event => {
    if (event.tag === 'acceptSignal') callback(event.signal);
  });
}

export const transportGateway = {
  signAndSubmitStatement,
  postChatMessageOnIdentityChannel,
  postChatMessageOnDeviceChannel,
  encodeMultiChatAccepted,
  postAcceptSignalV2,
  decodeEventsFromChatMessage,
  subscribeToIdentityChannelV2,
  subscribeToAcceptSignalV2,
};
