import { type ChatSession, type P2PChatRequest } from '@/domains/chat';
import { type DotNsUrl, dotNsService } from '@/domains/product';

export type ChatItemDensity = 'regular' | 'compact';

export type MessageSegment =
  | { type: 'text'; text: string }
  | { type: 'product'; text: string; target: DotNsUrl }
  | { type: 'external'; text: string; href: string };

// Polkadot SS58 addresses are base58-encoded 32-byte payloads — typical
// printed length is 47-49 chars, and substrate (prefix 42) addresses all
// start with `5`. This is good enough to detect a "name" that's really just
// the accountId and format it as `5H1e…0bMm` instead of showing the full
// 48-char string in the chat list / header.
const SS58_LIKE_RE = /^[1-9A-HJ-NP-Za-km-z]{46,49}$/;

function isSs58Like(value: string): boolean {
  return SS58_LIKE_RE.test(value);
}

function formatPeerName(name: string | undefined | null, accountId?: string): string {
  const raw = name && name.trim().length > 0 ? name : (accountId ?? '');
  if (!raw) return '';
  if (!isSs58Like(raw)) return raw;
  return `${raw.slice(0, 6)}…${raw.slice(-4)}`;
}

// Newest-first, comma-joined requester names for the incoming-requests inbox subtitle.
function formatRequesterNames(pendingRequests: P2PChatRequest[]): string {
  return [...pendingRequests]
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(request => formatPeerName(request.peerUsername, request.peerId))
    .join(', ');
}

/**
 * A session whose peer has a pending in/out request renders as a request row, not a
 * session row — so drop those sessions before they reach the chat list.
 */
function excludePendingSessions(
  sessions: ChatSession[],
  outgoingRequests: P2PChatRequest[],
  pendingRequests: P2PChatRequest[],
): ChatSession[] {
  const pendingPeerIds = new Set([...outgoingRequests, ...pendingRequests].map(request => request.peerId));

  return sessions.filter(session => !pendingPeerIds.has(session.sessionId));
}

// Density follows the widget SIZE, not measured height: the small widget (2 items,
// per CHAT_WIDGET_VISIBLE_COUNT) uses the compact Figma layout; medium/large use the
// rich regular layout. Small and medium per-item heights are too close (~80 vs ~90px
// on the fixed 100px grid row) for a reliable pixel threshold, and at small size a
// regular item crams its avatar against the slot's bottom edge.
function chatItemDensityForCount(visibleCount: number): ChatItemDensity {
  return visibleCount <= 2 ? 'compact' : 'regular';
}

function formatMessageDate(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
}

function formatLastMessageDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return formatMessageDate(timestamp);
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}

/**
 * Relative "time since last activity" for chat-list rows (rooms and request items),
 * so the whole list reads on one clock: under a minute → `now`, then `{n}m`, then
 * `{n}h` while still today; yesterday or earlier falls back to a compact date. `now`
 * is injected for deterministic tests.
 */
function formatChatListTime(timestamp: number, now: number = Date.now()): string {
  const date = new Date(timestamp);
  const nowDate = new Date(now);

  if (date.toDateString() === nowDate.toDateString()) {
    const diffMs = now - timestamp;
    if (diffMs < 60_000) return 'now';
    const diffMinutes = Math.floor(diffMs / 60_000);
    if (diffMinutes < 60) return `${diffMinutes}m`;

    return `${Math.floor(diffMinutes / 60)}h`;
  }

  const sameYear = date.getFullYear() === nowDate.getFullYear();

  return date.toLocaleDateString(
    'en-US',
    sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' },
  );
}

// 12-hour clock time for request-flow timestamps (incoming request bubble, outgoing request item).
function formatRequestTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// `M:SS` for sub-hour calls; `H:MM:SS` past an hour. Matches Figma copy.
function formatCallDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

// Punctuation that wraps a link in prose — `(see coff3r.paseo).` — and is never part of it.
const LEADING_WRAPPERS = new Set(['(', '[', '{', '"', "'", '«']);
const TRAILING_WRAPPERS = new Set(['.', ',', ';', ':', '!', '?', ')', ']', '}', '"', "'", '»']);

function classifyLink(core: string, tld: string): MessageSegment | null {
  // Whether a token names a product is `dotNsService`'s call alone. `isDotDomain`
  // drops the localhost targets `parseDotNsDomain` also accepts: a dev server named
  // in a peer's message is not a product.
  const target = dotNsService.parseDotNsDomain(core, tld);
  if (target && dotNsService.isDotDomain(target.identifier, tld)) {
    return { type: 'product', text: core, target };
  }

  // https only: main's window-open handler hands nothing else to the system browser.
  try {
    const url = new URL(core);
    return url.protocol === 'https:' ? { type: 'external', text: core, href: url.href } : null;
  } catch {
    return null;
  }
}

function appendText(segments: MessageSegment[], text: string) {
  if (!text) return;
  const last = segments.at(-1);
  if (last?.type === 'text') {
    last.text += text;
  } else {
    segments.push({ type: 'text', text });
  }
}

/**
 * Splits message text into plain text and links. Whitespace is kept verbatim, so
 * joining every segment's `text` reproduces the input.
 */
function toMessageSegments(text: string, tld: string): MessageSegment[] {
  const segments: MessageSegment[] = [];

  for (const token of text.split(/(\s+)/)) {
    let start = 0;
    let end = token.length;
    while (start < end && LEADING_WRAPPERS.has(token.charAt(start))) start++;
    while (end > start && TRAILING_WRAPPERS.has(token.charAt(end - 1))) end--;

    const core = token.slice(start, end);
    const link = core ? classifyLink(core, tld) : null;
    if (!link) {
      appendText(segments, token);
      continue;
    }

    appendText(segments, token.slice(0, start));
    segments.push(link);
    appendText(segments, token.slice(end));
  }

  return segments;
}

export const chatService = {
  formatPeerName,
  formatRequesterNames,
  excludePendingSessions,
  chatItemDensityForCount,
  formatMessageDate,
  formatLastMessageDate,
  formatChatListTime,
  formatRequestTime,
  formatCallDuration,
  toMessageSegments,
};
