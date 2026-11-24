import { type ChatMessage, type ChatMessageStatus, type MessageContent, type MessagePosition } from './types';

/**
 * `deviceChatAccepted`, `deviceAdded` and `token` rows exist only to replicate
 * peer metadata (device info, push token) to the user's other paired devices via
 * `device-sync`. They carry no user-facing content: `getPlainText`/
 * `getMessagePreview` both return '' for them, so they must be excluded from
 * every visible surface (chat bubbles, room-list preview, last-message
 * timestamp) — otherwise they render as an empty bubble and bump the room's
 * last-activity time.
 */
function isSyncCarrier(content: MessageContent): boolean {
  return content.type === 'deviceChatAccepted' || content.type === 'deviceAdded' || content.type === 'token';
}

/**
 * True when the message stands on its own in a conversation, rather than
 * servicing or modifying another message. Three groups are excluded: sync
 * carriers (device metadata replication), non-offer call signals (folded into
 * the offer's derived call state by `deriveCallStates`), and reactions/edits
 * (folded into their target message).
 *
 * This is the single rule behind every "which message does the user actually
 * see" decision: chat bubbles, the room-list preview, the last-activity
 * timestamp, and the unread count.
 */
function isStandaloneMessage(content: MessageContent): boolean {
  if (isSyncCarrier(content)) return false;
  if (content.type === 'callSignal' && content.signal !== 'offer') return false;

  return content.type !== 'reacted' && content.type !== 'reactionRemoved' && content.type !== 'edit';
}

/** The plain text a message contributes to search; text-less content (reactions, transfers, sync carriers) yields ''. */
function getSearchableText(content: MessageContent): string {
  switch (content.type) {
    case 'text':
      return content.text;
    case 'richText':
      return content.text ?? '';
    case 'reply':
      return getSearchableText(content.content);
    case 'edit':
      return content.newContent.text ?? '';
    default:
      return '';
  }
}

const OUTGOING_STATE_RANK: Record<string, number> = { new: 0, sent: 1, delivered: 2 };
const INCOMING_STATE_RANK: Record<string, number> = { new: 0, seen: 1 };

function statusRank(s: ChatMessageStatus): number {
  if (s.direction === 'outgoing') return OUTGOING_STATE_RANK[s.state] ?? 0;
  return INCOMING_STATE_RANK[s.state] ?? 0;
}

/**
 * Status is monotonic within a direction: outgoing `new → sent → delivered`,
 * incoming `new → seen`. Re-writes (a re-derived statement on reload, a peer
 * re-delivery, a sibling-device sync) must only ever advance it — never regress
 * it and never cross direction. The canonical example: opening a chat marks an
 * incoming message `seen`, but on the next launch the session replays the same
 * statement, re-deriving it as `new`; without this guard the read marker would
 * be clobbered and the unread badge would reappear.
 */
function shouldUpgradeStatus(current: ChatMessageStatus, incoming: ChatMessageStatus): boolean {
  if (current.direction !== incoming.direction) return false;
  return statusRank(incoming) > statusRank(current);
}

function positionOf(message: ChatMessage): MessagePosition {
  return { timestamp: message.timestamp, messageId: message.messageId };
}

/**
 * Orders by `timestamp`, then by `messageId` in UTF-16 code-unit order, the order IndexedDB
 * sorts string keys in. `localeCompare` would disagree with it (it puts `'a'` before `'B'`).
 */
function compareMessagePositions(a: MessagePosition, b: MessagePosition): number {
  if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
  if (a.messageId === b.messageId) return 0;
  return a.messageId < b.messageId ? -1 : 1;
}

/**
 * A seen receipt covers every message up to its position, so an outgoing message the peer
 * could have received (`sent` or `delivered`) is seen when it sits at or before `peerSeen`.
 */
function isSeenByPeer(message: ChatMessage, peerSeen: MessagePosition | null): boolean {
  if (!peerSeen) return false;
  if (message.status.direction !== 'outgoing' || message.status.state === 'new') return false;
  return compareMessagePositions(positionOf(message), peerSeen) <= 0;
}

export const chatMessageService = {
  isSyncCarrier,
  isStandaloneMessage,
  shouldUpgradeStatus,
  getSearchableText,
  positionOf,
  compareMessagePositions,
  isSeenByPeer,
};
