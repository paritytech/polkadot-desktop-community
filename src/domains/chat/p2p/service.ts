/**
 * Shared P2P chat helpers used across the container's sub-modules.
 *
 * - `computeSharedSecret` — X25519 key agreement used across the V2 chat
 *   stack (requests, session transport, multi-device crypto, and the V2
 *   manager's push-notification path).
 * - `stamp*` — `lastUpdate` stamp helpers for p2p-chat tables. Write-side
 *   callers use them so mutations bump `lastUpdate` and stay visible to
 *   device-sync's collector (`listMessagesChangedSince` & co in
 *   `repository.ts`).
 * - `isPending*Request` / `isCancelledIncomingRequest` — request-state predicates the read hooks filter by.
 * - `resolveIncomingCancel` — the receiver's decision for a peer's chat request cancel.
 * - `isRequestMessageHidden` — whether an incoming request's welcome message is
 *   currently hidden in the UI (carries a message, hiding is on, not yet revealed).
 * - `countsForSeenReceipt` / `findLastSeenMessage` / `resolvePeerSeen` — the seen receipt rules of RFC 0006:
 *   which messages a receipt may name, the one to name, and where a received receipt lands.
 * - `bytesEqual` / `buildSessionIdParam` — wire-byte helpers shared across the
 *   sub-modules (multi-device, session-transport, requests, notifications).
 */

import { x25519 } from '@noble/curves/ed25519.js';
import { mergeUint8 } from '@polkadot-api/utils';

import { chatMessageService } from '../session/service';
import { type ChatMessage, type MessagePosition } from '../session/types';

import { type IncomingCancelAction, type P2PChatRequest, type P2PRoom } from './types';

const SESSION_ID_SEPARATOR = new TextEncoder().encode('/');

/**
 * X25519 shared secret, used whole (CHAT-RFC-0004) — matches host-papp's
 * `createSharedSecret`. `@noble` aborts on an all-zero result (RFC 7748), so a
 * hostile peer key fails loudly.
 */
function computeSharedSecret(privateKey: Uint8Array, peerPublicKey: Uint8Array): Uint8Array {
  return x25519.getSharedSecret(privateKey, peerPublicKey);
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

function isCancelledIncomingRequest(request: P2PChatRequest): boolean {
  return request.direction === 'incoming' && request.status === 'cancelled';
}

type IncomingCancel = { requestId: string; peerId: string; timestamp: number };

function isRequestSystemMessage(message: ChatMessage, requestId: string): boolean {
  const { content } = message;

  return (
    message.messageId === requestId ||
    content.type === 'contactAdded' ||
    content.type === 'leftChat' ||
    chatMessageService.isSyncCarrier(content)
  );
}

/**
 * How a peer's cancel applies to the local request (RFC 0007). A cancel with no row is
 * kept as a tombstone, so the request it outruns on the wire cannot land later. An accepted
 * request is cancelled only while nobody has talked yet: once the room holds a message beyond
 * the request's own system rows, or the user blocked the peer, the chat stands.
 */
function resolveIncomingCancel(params: {
  cancel: IncomingCancel;
  request: P2PChatRequest | undefined;
  room: P2PRoom | undefined;
  messages: ChatMessage[];
}): IncomingCancelAction {
  const { cancel, request, room, messages } = params;

  if (!request) return 'tombstone';

  const isNewerCancelFromRowPeer =
    request.direction === 'incoming' && request.peerId === cancel.peerId && cancel.timestamp > request.timestamp;
  if (!isNewerCancelFromRowPeer) return 'ignore';

  if (request.status === 'pending') return 'cancelPending';

  if (
    request.status === 'accepted' &&
    room?.isBlocked !== true &&
    messages.every(message => isRequestSystemMessage(message, cancel.requestId))
  ) {
    return 'cancelAccepted';
  }

  return 'ignore';
}

/**
 * Whether an incoming request's message should be hidden in the UI: the request
 * carries a message, hiding is on by default, and the user hasn't revealed it
 * yet (the per-request `revealed` flag overrides the default).
 */
function isRequestMessageHidden(request: P2PChatRequest, hideByDefault: boolean): boolean {
  return Boolean(request.welcomeMessage) && hideByDefault && request.revealed !== true;
}

/**
 * RFC 0006: an incoming message the user has seen, of a kind a seen receipt may name.
 *
 * Not `chatMessageService.isStandaloneMessage`: the RFC counts the `answer` and `closed` call
 * signals that the UI folds into their offer.
 */
function countsForSeenReceipt(message: ChatMessage): boolean {
  const { content, status } = message;
  if (status.direction !== 'incoming' || status.state !== 'seen') return false;

  switch (content.type) {
    case 'text':
    case 'richText':
    case 'reply':
    case 'transfer':
      return true;
    case 'callSignal':
      return content.signal !== 'ice';
    case 'custom':
    case 'reacted':
    case 'reactionRemoved':
    case 'edit':
    case 'contactAdded':
    case 'leftChat':
    case 'token':
    case 'deviceChatAccepted':
    case 'deviceAdded':
      return false;
    default: {
      const unhandled: never = content;

      return unhandled;
    }
  }
}

function findLastSeenMessage(messages: ChatMessage[]): ChatMessage | null {
  let last: ChatMessage | null = null;
  for (const message of messages) {
    if (!countsForSeenReceipt(message)) continue;
    const isLater =
      !last ||
      chatMessageService.compareMessagePositions(chatMessageService.positionOf(message), chatMessageService.positionOf(last)) > 0;
    if (isLater) last = message;
  }

  return last;
}

/**
 * Where a received seen receipt lands among our messages. The named outgoing message wins, even
 * while still `new` locally; otherwise the receipt covers the latest outgoing message the peer
 * could have received (`sent` or `delivered`) at or before the receipt's timestamp.
 */
function resolvePeerSeen(messages: ChatMessage[], seen: { messageId: string; timestamp: number }): MessagePosition | null {
  let fallback: MessagePosition | null = null;
  for (const message of messages) {
    if (message.status.direction !== 'outgoing') continue;
    const position = chatMessageService.positionOf(message);
    if (message.messageId === seen.messageId) return position;
    if (message.status.state === 'new' || message.timestamp > seen.timestamp) continue;
    if (!fallback || chatMessageService.compareMessagePositions(position, fallback) > 0) fallback = position;
  }

  return fallback;
}

export const p2pService = {
  countsForSeenReceipt,
  findLastSeenMessage,
  resolvePeerSeen,
  computeSharedSecret,
  bytesEqual,
  buildSessionIdParam,
  stampMessage,
  stampRoom,
  stampRequest,
  isPendingIncomingRequest,
  isPendingOutgoingRequest,
  isCancelledIncomingRequest,
  resolveIncomingCancel,
  isRequestMessageHidden,
};
