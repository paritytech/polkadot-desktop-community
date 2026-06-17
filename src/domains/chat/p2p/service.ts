/**
 * Shared P2P chat helpers used across the container's sub-modules.
 *
 * - `computeSharedSecret` — P-256 ECDH derivation used across the V2 chat
 *   stack (requests, session transport, multi-device crypto, and the V2
 *   manager's push-notification path).
 * - `stamp*` — `lastUpdate` stamp helpers for p2p-chat tables. Write-side
 *   callers use them so mutations bump `lastUpdate` and stay visible to
 *   device-sync's collector (`listMessagesChangedSince` & co in
 *   `repository.ts`).
 * - `isPending*Request` — request-state predicates the read hooks filter by.
 * - `bytesEqual` / `buildSessionIdParam` — wire-byte helpers shared across the
 *   sub-modules (multi-device, session-transport, requests, notifications).
 */

import { p256 } from '@noble/curves/nist.js';
import { mergeUint8 } from '@polkadot-api/utils';

import { type ChatMessage } from '../session/types';

import { type P2PChatRequest, type P2PRoom } from './types';

const SESSION_ID_SEPARATOR = new TextEncoder().encode('/');

/**
 * Compute ECDH shared secret between our P256 private key and peer's P256 public key.
 * Returns the X coordinate (32 bytes), matching host-papp's createSharedSecret.
 */
function computeSharedSecret(privateKey: Uint8Array, peerPublicKey: Uint8Array): Uint8Array {
  return p256.getSharedSecret(privateKey, peerPublicKey).slice(1, 33);
}

/** Byte-for-byte equality for two `Uint8Array`s (length-checked first). */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;

  return true;
}

/**
 * `SessionIdParam(A, B) = AccountId(A) : AccountId(B) : "/" : "/"` (no PINs on
 * desktop). The shared building block for session topics (requests) and push
 * ids (notifications) — must stay byte-identical across both call sites.
 */
function buildSessionIdParam(accountIdA: Uint8Array, accountIdB: Uint8Array): Uint8Array {
  return mergeUint8([accountIdA, accountIdB, SESSION_ID_SEPARATOR, SESSION_ID_SEPARATOR]);
}

function stampMessage(m: ChatMessage): ChatMessage {
  return { ...m, lastUpdate: Date.now() };
}

function stampRoom(r: P2PRoom): P2PRoom {
  return { ...r, lastUpdate: Date.now() };
}

function stampRequest(r: P2PChatRequest): P2PChatRequest {
  return { ...r, lastUpdate: Date.now() };
}

function isPendingIncomingRequest(request: P2PChatRequest): boolean {
  return request.direction === 'incoming' && request.status === 'pending';
}

function isPendingOutgoingRequest(request: P2PChatRequest): boolean {
  return request.direction === 'outgoing' && request.status === 'pending';
}

export const p2pService = {
  computeSharedSecret,
  bytesEqual,
  buildSessionIdParam,
  stampMessage,
  stampRoom,
  stampRequest,
  isPendingIncomingRequest,
  isPendingOutgoingRequest,
};
