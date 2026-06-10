/**
 * V2 discovery topic derivation for multi-device chat requests.
 *
 *   StatementRequest.topic1  = SessionId(D(A), B)
 *   StatementRequest.channel = khash(SessionId(D(A), B), "request")
 *
 * V1 used the recipient's user accountId as the sole topic input
 * (`chatRequestTopics.ts`); V2 extends the input set to (senderDevice,
 * recipientUser) so each sending device gets its own topic and a recipient
 * can subscribe to all known sender-device topics with a single `matchAny`
 * filter — keeping the per-client subscription count under the
 * statement-store budget.
 *
 * Q2 substitution: `D(A)` is the sender's device sr25519 statementAccountId
 * (32 bytes), matching V1's accountId byte width. `B` is the recipient's
 * user identity sr25519 (also 32 bytes). The contact's per-device encryption
 * pubkeys are *not* part of the topic input — they're used only for the
 * per-recipient-device wrap of REQ_PK in `MultiDeviceRequest.devicesInfo`.
 */

import { blake2b } from '@noble/hashes/blake2.js';
import { khash } from '@novasamatech/statement-store';
import { Bytes, Struct, u64 } from 'scale-ts';

const CONTEXT = new TextEncoder().encode('chat-request');

const TopicV2WithoutDay = Struct({
  context: Bytes(),
  senderDeviceAccountId: Bytes(),
  recipientUserAccountId: Bytes(),
});

const TopicV2WithDay = Struct({
  context: Bytes(),
  senderDeviceAccountId: Bytes(),
  recipientUserAccountId: Bytes(),
  day: u64,
});

/**
 * Full-history topic for the (senderDevice, recipientUser) pair —
 * used by the recipient for initial sync of all messages from this
 * specific sender device.
 *
 *   blake2b-256(SCALE(context, senderDeviceAccountId, recipientUserAccountId))
 */
export const computeAllPeerTopicV2 = (senderDeviceAccountId: Uint8Array, recipientUserAccountId: Uint8Array): Uint8Array => {
  const encoded = TopicV2WithoutDay.enc({
    context: CONTEXT,
    senderDeviceAccountId,
    recipientUserAccountId,
  });
  return blake2b(encoded, { dkLen: 32 });
};

/**
 * Day-scoped topic for the (senderDevice, recipientUser) pair —
 * used for incremental day-bucketed subscriptions.
 *
 *   blake2b-256(SCALE(context, senderDeviceAccountId, recipientUserAccountId, day))
 */
export const computePaginationTopicV2 = (
  senderDeviceAccountId: Uint8Array,
  recipientUserAccountId: Uint8Array,
  day: bigint,
): Uint8Array => {
  const encoded = TopicV2WithDay.enc({
    context: CONTEXT,
    senderDeviceAccountId,
    recipientUserAccountId,
    day,
  });
  return blake2b(encoded, { dkLen: 32 });
};

/**
 * Channel topic for monitoring a specific request session.
 * Mirrors V1's khash construction; `sessionIdParam` carries
 * the per-request unique seed (e.g., the hoisted ephemeral pubkey).
 *
 *   khash(sharedSecret, "chat-request" || sessionIdParam)
 */
export const computeChannelTopicV2 = (sessionIdParam: Uint8Array, sharedSecret: Uint8Array): Uint8Array => {
  const message = new Uint8Array(CONTEXT.length + sessionIdParam.length);
  message.set(CONTEXT, 0);
  message.set(sessionIdParam, CONTEXT.length);
  return khash(sharedSecret, message);
};

/**
 * Compute the matchAny topic set a recipient should subscribe to —
 * one pagination topic per known sender device.
 *
 * Used by the receive side to bound subscriptions: each contact
 * contributes N topics (one per known device of that contact),
 * fanned into a single matchAny filter.
 */
export const computePeerSubscriptionTopicsV2 = (
  senderDeviceAccountIds: Uint8Array[],
  recipientUserAccountId: Uint8Array,
  day: bigint,
): Uint8Array[] =>
  senderDeviceAccountIds.map(senderDeviceId => computePaginationTopicV2(senderDeviceId, recipientUserAccountId, day));
