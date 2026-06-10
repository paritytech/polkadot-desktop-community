/**
 * Discovery topic derivation for chat requests.
 *
 * Must match iOS byte-for-byte:
 *   - ChatRequest+PaginationTopic.swift → allPeerTopic, paginationTopic
 *   - ChatRequestFactory.swift → channelTopic
 *
 * Topics are blake2b-256 hashes of SCALE-encoded inputs.
 */

import { blake2b } from '@noble/hashes/blake2.js';
import { khash } from '@novasamatech/statement-store';
import { Bytes, Struct, u64 } from 'scale-ts';

// April 2, 2025 00:00:00 UTC — same epoch as iOS
const EPOCH = 1_763_164_800;
const SECONDS_IN_DAY = 86_400;

const CONTEXT = new TextEncoder().encode('chat-request');

// SCALE codecs for topic input
const TopicWithoutDay = Struct({ context: Bytes(), accountId: Bytes() });
const TopicWithDay = Struct({ context: Bytes(), accountId: Bytes(), day: u64 });

/**
 * Returns the current day number since EPOCH and seconds until the next day.
 * Returns null if the current time is before the epoch.
 */
export const getCurrentDay = (): { day: bigint; remainedTillNext: number } | null => {
  const nowSecs = Math.floor(Date.now() / 1000);
  const elapsed = nowSecs - EPOCH;
  if (elapsed < 0) return null;

  const dayNumber = Math.floor(elapsed / SECONDS_IN_DAY);
  const nextDayStart = EPOCH + (dayNumber + 1) * SECONDS_IN_DAY;

  return {
    day: BigInt(dayNumber),
    remainedTillNext: nextDayStart - nowSecs,
  };
};

/**
 * Full-history topic for a recipient — used for initial sync.
 * blake2b-256(SCALE(context: Bytes, accountId: Bytes))
 */
export const computeAllPeerTopic = (recipientAccountId: Uint8Array): Uint8Array => {
  const encoded = TopicWithoutDay.enc({ context: CONTEXT, accountId: recipientAccountId });

  return blake2b(encoded, { dkLen: 32 });
};

/**
 * Day-scoped topic for a recipient — used for incremental subscriptions.
 * blake2b-256(SCALE(context: Bytes, accountId: Bytes, day: u64))
 */
export const computePaginationTopic = (recipientAccountId: Uint8Array, day: bigint): Uint8Array => {
  const encoded = TopicWithDay.enc({ context: CONTEXT, accountId: recipientAccountId, day });

  return blake2b(encoded, { dkLen: 32 });
};

/**
 * Channel topic for monitoring accept signals on a specific request.
 * khash(concat("chat-request", sessionIdParam), sharedSecret)
 */
export const computeChannelTopic = (sessionIdParam: Uint8Array, sharedSecret: Uint8Array): Uint8Array => {
  const message = new Uint8Array(CONTEXT.length + sessionIdParam.length);
  message.set(CONTEXT, 0);
  message.set(sessionIdParam, CONTEXT.length);

  return khash(sharedSecret, message);
};

// ── Session topics (Transport Layer spec) ──────────────────────────

const SESSION_PREFIX = new TextEncoder().encode('session');
const SEPARATOR = new TextEncoder().encode('/');

/**
 * Compute SessionIdParam(A, B) = AccountId(A) : AccountId(B) : "/" : Pin(A) : "/" : Pin(B)
 * Without PINs: AccountId(A) : AccountId(B) : "/" : "/"
 */
const buildSessionIdParam = (accountIdA: Uint8Array, accountIdB: Uint8Array): Uint8Array => {
  const len = accountIdA.length + accountIdB.length + SEPARATOR.length + SEPARATOR.length;
  const result = new Uint8Array(len);
  let offset = 0;
  result.set(accountIdA, offset);
  offset += accountIdA.length;
  result.set(accountIdB, offset);
  offset += accountIdB.length;
  result.set(SEPARATOR, offset);
  offset += SEPARATOR.length;
  result.set(SEPARATOR, offset);

  return result;
};

/**
 * Compute the incoming session topic from a peer.
 * SessionId(B, A) = khash(K(A,B), "session" : SessionIdParam(B, A))
 *
 * When Android/iOS accepts a chat request, it sends a ChatAccepted message
 * on its outgoing session topic = SessionId(B, A). We subscribe to this
 * topic to detect the accept.
 */
export const computeIncomingSessionTopic = (
  ownAccountId: Uint8Array,
  peerAccountId: Uint8Array,
  sharedSecret: Uint8Array,
): Uint8Array => {
  // SessionIdParam(B, A) = AccountId(B) : AccountId(A) : "/" : "/"
  const sessionIdParam = buildSessionIdParam(peerAccountId, ownAccountId);
  // SessionId(B, A) = khash(K, "session" + SessionIdParam(B, A))
  const message = new Uint8Array(SESSION_PREFIX.length + sessionIdParam.length);
  message.set(SESSION_PREFIX, 0);
  message.set(sessionIdParam, SESSION_PREFIX.length);

  return khash(sharedSecret, message);
};
