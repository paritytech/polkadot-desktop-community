/**
 * Discovery topic derivation for chat requests — V1 and V2.
 *
 * V1 must match iOS byte-for-byte:
 *   - ChatRequest+PaginationTopic.swift → allPeerTopic, paginationTopic
 *   - ChatRequestFactory.swift → channelTopic
 *
 * Topics are blake2b-256 hashes of SCALE-encoded inputs.
 *
 * V2 (multi-device):
 *   StatementRequest.topic1  = SessionId(D(A), B)
 *   StatementRequest.channel = khash(SessionId(D(A), B), "request")
 *
 * V1 used the recipient's user accountId as the sole topic input; V2 extends
 * the input set to (senderDevice, recipientUser) so each sending device gets
 * its own topic and a recipient can subscribe to all known sender-device
 * topics with a single `matchAny` filter — keeping the per-client
 * subscription count under the statement-store budget.
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

import { p2pService } from '../service';

// April 2, 2025 00:00:00 UTC — same epoch as iOS
const EPOCH = 1_763_164_800;
const SECONDS_IN_DAY = 86_400;

const CONTEXT = new TextEncoder().encode('chat-request');

// SCALE codecs for topic input
const TopicWithoutDay = Struct({ context: Bytes(), accountId: Bytes() });
const TopicWithDay = Struct({ context: Bytes(), accountId: Bytes(), day: u64 });

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
 * Returns the current day number since EPOCH and seconds until the next day.
 * Returns null if the current time is before the epoch.
 */
function getCurrentDay(): { day: bigint; remainedTillNext: number } | null {
  const nowSecs = Math.floor(Date.now() / 1000);
  const elapsed = nowSecs - EPOCH;
  if (elapsed < 0) return null;

  const dayNumber = Math.floor(elapsed / SECONDS_IN_DAY);
  const nextDayStart = EPOCH + (dayNumber + 1) * SECONDS_IN_DAY;

  return {
    day: BigInt(dayNumber),
    remainedTillNext: nextDayStart - nowSecs,
  };
}

/**
 * Full-history topic for a recipient — used for initial sync.
 * blake2b-256(SCALE(context: Bytes, accountId: Bytes))
 */
function computeAllPeerTopic(recipientAccountId: Uint8Array): Uint8Array {
  const encoded = TopicWithoutDay.enc({ context: CONTEXT, accountId: recipientAccountId });

  return blake2b(encoded, { dkLen: 32 });
}

/**
 * Day-scoped topic for a recipient — used for incremental subscriptions.
 * blake2b-256(SCALE(context: Bytes, accountId: Bytes, day: u64))
 */
function computePaginationTopic(recipientAccountId: Uint8Array, day: bigint): Uint8Array {
  const encoded = TopicWithDay.enc({ context: CONTEXT, accountId: recipientAccountId, day });

  return blake2b(encoded, { dkLen: 32 });
}

/**
 * Channel topic for monitoring accept signals on a specific request.
 * khash(concat("chat-request", sessionIdParam), sharedSecret)
 */
function computeChannelTopic(sessionIdParam: Uint8Array, sharedSecret: Uint8Array): Uint8Array {
  const message = new Uint8Array(CONTEXT.length + sessionIdParam.length);
  message.set(CONTEXT, 0);
  message.set(sessionIdParam, CONTEXT.length);

  return khash(sharedSecret, message);
}

// ── Session topics (Transport Layer spec) ──────────────────────────

const SESSION_PREFIX = new TextEncoder().encode('session');

/**
 * Compute the incoming session topic from a peer.
 * SessionId(B, A) = khash(K(A,B), "session" : SessionIdParam(B, A))
 *
 * When Android/iOS accepts a chat request, it sends a ChatAccepted message
 * on its outgoing session topic = SessionId(B, A). We subscribe to this
 * topic to detect the accept.
 */
function computeIncomingSessionTopic(ownAccountId: Uint8Array, peerAccountId: Uint8Array, sharedSecret: Uint8Array): Uint8Array {
  // SessionIdParam(B, A) = AccountId(B) : AccountId(A) : "/" : "/"
  const sessionIdParam = p2pService.buildSessionIdParam(peerAccountId, ownAccountId);
  // SessionId(B, A) = khash(K, "session" + SessionIdParam(B, A))
  const message = new Uint8Array(SESSION_PREFIX.length + sessionIdParam.length);
  message.set(SESSION_PREFIX, 0);
  message.set(sessionIdParam, SESSION_PREFIX.length);

  return khash(sharedSecret, message);
}

// ── V2 topics (multi-device) ───────────────────────────────────────

/**
 * Full-history topic for the (senderDevice, recipientUser) pair —
 * used by the recipient for initial sync of all messages from this
 * specific sender device.
 *
 *   blake2b-256(SCALE(context, senderDeviceAccountId, recipientUserAccountId))
 */
function computeAllPeerTopicV2(senderDeviceAccountId: Uint8Array, recipientUserAccountId: Uint8Array): Uint8Array {
  const encoded = TopicV2WithoutDay.enc({
    context: CONTEXT,
    senderDeviceAccountId,
    recipientUserAccountId,
  });
  return blake2b(encoded, { dkLen: 32 });
}

/**
 * Day-scoped topic for the (senderDevice, recipientUser) pair —
 * used for incremental day-bucketed subscriptions.
 *
 *   blake2b-256(SCALE(context, senderDeviceAccountId, recipientUserAccountId, day))
 */
function computePaginationTopicV2(
  senderDeviceAccountId: Uint8Array,
  recipientUserAccountId: Uint8Array,
  day: bigint,
): Uint8Array {
  const encoded = TopicV2WithDay.enc({
    context: CONTEXT,
    senderDeviceAccountId,
    recipientUserAccountId,
    day,
  });
  return blake2b(encoded, { dkLen: 32 });
}

/**
 * Channel topic for monitoring a specific request session.
 * Mirrors V1's khash construction; `sessionIdParam` carries
 * the per-request unique seed (e.g., the hoisted ephemeral pubkey).
 *
 *   khash(sharedSecret, "chat-request" || sessionIdParam)
 */
function computeChannelTopicV2(sessionIdParam: Uint8Array, sharedSecret: Uint8Array): Uint8Array {
  const message = new Uint8Array(CONTEXT.length + sessionIdParam.length);
  message.set(CONTEXT, 0);
  message.set(sessionIdParam, CONTEXT.length);
  return khash(sharedSecret, message);
}

/**
 * Compute the matchAny topic set a recipient should subscribe to —
 * one pagination topic per known sender device.
 *
 * Used by the receive side to bound subscriptions: each contact
 * contributes N topics (one per known device of that contact),
 * fanned into a single matchAny filter.
 */
function computePeerSubscriptionTopicsV2(
  senderDeviceAccountIds: Uint8Array[],
  recipientUserAccountId: Uint8Array,
  day: bigint,
): Uint8Array[] {
  return senderDeviceAccountIds.map(senderDeviceId => computePaginationTopicV2(senderDeviceId, recipientUserAccountId, day));
}

export const chatRequestTopicService = {
  getCurrentDay,
  computeAllPeerTopic,
  computePaginationTopic,
  computeChannelTopic,
  computeIncomingSessionTopic,
  computeAllPeerTopicV2,
  computePaginationTopicV2,
  computeChannelTopicV2,
  computePeerSubscriptionTopicsV2,
};
