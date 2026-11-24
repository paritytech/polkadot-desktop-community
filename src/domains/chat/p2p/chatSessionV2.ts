/**
 * V2 multi-device chat-session transport.
 *
 * A thin adapter over `createMultiDeviceSession` from `@novasamatech/statement-store`,
 * which now owns everything this file used to implement by hand: the `MultiRequest` /
 * `MultiResponse` envelope, per-device topic derivation, batching every unacknowledged
 * message onto each new statement, dedup, expiry allocation and submit retries.
 *
 * What the SDK removed, and why it is safe to drop:
 *
 *  - **The localStorage outbox.** It existed because this file believed our own
 *    `MultiRequest` inner was unreadable to us. It is not: the per-device wrap secret is
 *    `x25519(ownDevicePriv, recipientDevicePub)`, which the sender can re-derive for any
 *    recipient it wrapped for. The SDK reads the unacknowledged batch back out of the
 *    statement store during initialization, so the store is the source of truth and the
 *    persisted record is redundant. What the store cannot restore is the per-message
 *    waiter — hence `onBatchDelivered`, which carries `delivered` across a restart.
 *  - **One subscription per peer device.** The SDK opens a single `matchAny` subscription
 *    over every device topic and re-opens it when the roster changes.
 *  - **Session recreation on a roster change.** `peerRoster` is read live, so a device
 *    added or removed mid-conversation is picked up by the running session.
 *
 * Seen receipts (chat-spec RFC 0006) are transient: never stored as a message, never pushed.
 * The session runs with `keepSingleSeenMessage`, so at most one undelivered receipt per peer
 * is ever pending — a newer one replaces it, an identical one is not sent again.
 *
 * Statement proofs are signed with this device's sr25519 (the user-identity sr25519 never
 * leaves PApp). Message-level concerns — dedup by id, status mapping, push — stay with the
 * manager, exactly as before.
 */

import { ChatMessage as ChatMessageCodec } from '@novasamatech/host-chat/codec/message';
import { keepSingleSeenMessage } from '@novasamatech/host-chat/seen';
import {
  type PeerRoster,
  MessageReplacedError,
  createAccountId,
  createMultiDeviceSession,
  createSlotAccountProver,
} from '@novasamatech/statement-store';
import { nanoid } from 'nanoid';
import { type CodecType } from 'scale-ts';

type ChatContent = CodecType<typeof ChatMessageCodec>['versioned']['value'];

const MESSAGE_TOO_LARGE_ERROR_NAME = 'MessageTooLargeError';

// No error classes (style.md) — a name-tagged Error + predicate. The SDK rejects an
// unsendable message with a plain Error; tagging it here keeps the predicate consumers
// already use (`chat/index.ts`, the manager's send path) working unchanged.
function asMessageTooLargeError(cause: Error): Error {
  const error = new Error(`[chat-session-v2] message cannot be sent: ${cause.message}`);
  error.name = MESSAGE_TOO_LARGE_ERROR_NAME;

  return error;
}

/** True for the `send()` rejection meaning "this message can never reach a statement". */
export function isMessageTooLargeError(err: unknown): boolean {
  return err instanceof Error && err.name === MESSAGE_TOO_LARGE_ERROR_NAME;
}

export type V2ChatPeerSessionParams = {
  /** Local user identity chat X25519 private scalar (32 bytes), shared across our devices. */
  identityChatPrivateKey: Uint8Array;
  /** Local user identity sr25519 (32 bytes). */
  ownIdentityAccountId: Uint8Array;
  /** This device's sr25519 statement-account public key (32 bytes). */
  ownDeviceStatementAccountId: Uint8Array;
  /** This device's per-device X25519 private key (32 bytes). */
  ownDeviceEncryptionPrivateKey: Uint8Array;
  /** This device's canonical sr25519 secret (64 bytes) for signing statements. */
  ownDeviceSeed: Uint8Array;
  /** Peer user identity sr25519 (32 bytes). */
  peerIdentityAccountId: Uint8Array;
  /** Peer user identity chat X25519 pubkey (32 bytes). */
  peerIdentityChatPublicKey: Uint8Array;
  /** The peer's devices, read live — see `peerRoster.ts`. */
  peerRoster: PeerRoster;
  statementStore: Parameters<typeof createMultiDeviceSession>[0]['statementStore'];
  /** Called for every chat message decoded from incoming statements. */
  onMessage: (msg: { messageId: string; timestamp: number; content: ChatContent }) => void;
  /** The peer acknowledged one of our messages: `sent` → `delivered`. */
  onDelivered: (messageId: string) => void;
  /**
   * The peer acknowledged the outgoing batch, which carries every message they haven't
   * acked yet. Messages sent in THIS run resolve through `onDelivered`; this covers the
   * ones restored from a previous run, whose waiter tokens the SDK cannot restore.
   */
  onBatchDelivered?: () => void;
  /** The message is on a submitted statement: `new` → `sent`. Also gates the push. */
  onSent: (messageId: string) => void;
  /** The message can never go out (too large, or no usable peer device). */
  onUndeliverable?: (messageId: string) => void;
};

/** How a seen receipt ended: answered, superseded by a newer receipt, or not delivered. */
export type SeenReceiptOutcome = 'delivered' | 'replaced' | 'failed';

export type V2ChatPeerSession = {
  /**
   * `opts.messageId`/`opts.timestamp` let the caller pre-allocate the identity so it can
   * persist optimistically before submission.
   */
  send: (
    content: ChatContent,
    opts?: { messageId?: string; timestamp?: number },
  ) => Promise<{
    messageId: string;
    timestamp: number;
  }>;
  /** Sends a seen receipt (RFC 0006). Touches no message status: a receipt is not a message. */
  sendSeen: (seen: { messageId: string; timestamp: number }) => Promise<SeenReceiptOutcome>;
  dispose: () => void;
};

export const createChatPeerSessionV2 = (params: V2ChatPeerSessionParams): V2ChatPeerSession => {
  const {
    identityChatPrivateKey,
    ownIdentityAccountId,
    ownDeviceStatementAccountId,
    ownDeviceEncryptionPrivateKey,
    ownDeviceSeed,
    peerIdentityAccountId,
    peerIdentityChatPublicKey,
    peerRoster,
    statementStore,
    onMessage,
    onDelivered,
    onBatchDelivered,
    onSent,
    onUndeliverable,
  } = params;

  const session = createMultiDeviceSession({
    localDevice: {
      statementAccountId: ownDeviceStatementAccountId,
      encryptionPrivateKey: ownDeviceEncryptionPrivateKey,
    },
    localIdentity: {
      accountId: createAccountId(ownIdentityAccountId),
      chatPrivateKey: identityChatPrivateKey,
    },
    remoteIdentity: {
      accountId: createAccountId(peerIdentityAccountId),
      chatPublicKey: peerIdentityChatPublicKey,
    },
    peerRoster,
    statementStore,
    prover: createSlotAccountProver(ownDeviceSeed),
    replacementPolicy: keepSingleSeenMessage,
  });

  const seenMessageIds = new Set<string>();

  // Subscribing is also what opens the store subscription, so this must happen even
  // though the manager only cares about requests.
  const unsubscribe = session.subscribe(ChatMessageCodec, messages => {
    for (const message of messages) {
      if (message.type === 'response') {
        // One response acknowledges the whole outgoing batch, and the batch carries every
        // message the peer hasn't acked. Live sends resolve through their own waiter; this
        // is the only signal reaching messages restored from a previous run, whose tokens
        // the SDK explicitly cannot restore ("nobody is awaiting them").
        if (message.responseCode === 'success') onBatchDelivered?.();
        continue;
      }
      // An undecodable entry is one message the peer sent that this build cannot read;
      // the rest of the batch is unaffected.
      if (message.payload.status !== 'parsed') continue;

      const chatMsg = message.payload.value;
      if (seenMessageIds.has(chatMsg.messageId)) continue;
      seenMessageIds.add(chatMsg.messageId);

      onMessage({
        messageId: chatMsg.messageId,
        timestamp: Number(chatMsg.timestamp),
        content: chatMsg.versioned.value,
      });
    }
  });

  // ACK only what decoded, so the peer can advance its own outgoing messages to `delivered`.
  // Mirrors iOS: the ack follows a successful decode, not the user reading. A blanket
  // 'success' would tell the peer we received a message this build silently dropped.
  const stopResponding = session.respondToRequests(ChatMessageCodec, request =>
    request.payload.status === 'parsed' ? 'success' : 'decodingFailed',
  );

  const send = async (content: ChatContent, opts?: { messageId?: string; timestamp?: number }) => {
    const messageId = opts?.messageId ?? nanoid(12);
    const timestamp = opts?.timestamp ?? Date.now();

    // Annotated so `versioned.tag` stays the literal 'v1' rather than widening to string.
    const payload: CodecType<typeof ChatMessageCodec> = {
      messageId,
      timestamp: BigInt(timestamp),
      versioned: { tag: 'v1', value: content },
    };
    const submitted = await session.submitRequestMessage(ChatMessageCodec, payload);

    if (submitted.isErr()) {
      // Too large for a statement, or no usable peer device — it can never go out.
      onUndeliverable?.(messageId);
      throw asMessageTooLargeError(submitted.error);
    }

    // NOTE: the SDK acknowledges acceptance into the outgoing batch, not the moment the
    // statement lands, so `sent` is optimistic here and nothing walks it back.
    onSent(messageId);

    void session.waitForResponseMessage(submitted.value.requestId).match(
      () => onDelivered(messageId),
      error => {
        // Also fires on dispose (the SDK rejects every pending waiter), where the message
        // is still live in the store. Log only — treating this as undeliverable would drop
        // a good row on every session teardown.
        console.warn('[chat-session-v2] delivery waiter settled without an ack for %s: %s', messageId, error.message);
      },
    );

    return { messageId, timestamp };
  };

  const sendSeen = async (seen: { messageId: string; timestamp: number }): Promise<SeenReceiptOutcome> => {
    const payload: CodecType<typeof ChatMessageCodec> = {
      messageId: nanoid(12),
      timestamp: BigInt(Date.now()),
      versioned: {
        tag: 'v1',
        value: { tag: 'seen', value: { messageId: seen.messageId, timestamp: BigInt(seen.timestamp) } },
      },
    };
    const submitted = await session.submitRequestMessage(ChatMessageCodec, payload);

    if (submitted.isErr()) {
      console.warn('[chat-session-v2] seen receipt for %s was not submitted: %s', seen.messageId, submitted.error.message);

      return 'failed';
    }

    return session.waitForResponseMessage(submitted.value.requestId).match<SeenReceiptOutcome>(
      response => (response.responseCode === 'success' ? 'delivered' : 'failed'),
      error => {
        // A replaced receipt is the policy working: the newer receipt carries it forward.
        if (error instanceof MessageReplacedError) return 'replaced';
        console.debug('[chat-session-v2] seen receipt waiter for %s settled without an ack: %s', seen.messageId, error.message);

        return 'failed';
      },
    );
  };

  return {
    send,
    sendSeen,
    dispose: () => {
      stopResponding();
      unsubscribe();
      session.dispose();
    },
  };
};
