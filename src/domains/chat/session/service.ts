import { type ChatMessageStatus, type MessageContent } from './types';

/**
 * `deviceChatAccepted` and `deviceAdded` rows exist only to replicate the
 * peer's device info to the user's other paired devices via `device-sync`.
 * They carry no user-facing content: `getPlainText`/`getMessagePreview` both
 * return '' for them, so they must be excluded from every visible surface
 * (chat bubbles, room-list preview, last-message timestamp) — otherwise they
 * render as an empty bubble and bump the room's last-activity time.
 */
function isSyncCarrier(content: MessageContent): boolean {
  return content.type === 'deviceChatAccepted' || content.type === 'deviceAdded';
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

export const chatMessageService = { isSyncCarrier, shouldUpgradeStatus };
