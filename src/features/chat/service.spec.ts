import { NEVER } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { type ChatSession, type P2PChatRequest } from '@/domains/chat';

import { chatService } from './service';

describe('chatItemDensityForCount', () => {
  it('uses compact layout for the small widget (≤ 2 items)', () => {
    expect(chatService.chatItemDensityForCount(1)).toBe('compact');
    expect(chatService.chatItemDensityForCount(2)).toBe('compact');
  });

  it('uses the rich regular layout for medium and large widgets', () => {
    expect(chatService.chatItemDensityForCount(4)).toBe('regular');
    expect(chatService.chatItemDensityForCount(8)).toBe('regular');
  });
});

describe('formatChatListTime', () => {
  const now = new Date('2024-06-15T12:00:00').getTime();

  it('shows "now" under a minute', () => {
    expect(chatService.formatChatListTime(now - 30_000, now)).toBe('now');
    expect(chatService.formatChatListTime(now, now)).toBe('now');
  });

  it('shows minutes under an hour', () => {
    expect(chatService.formatChatListTime(now - 60_000, now)).toBe('1m');
    expect(chatService.formatChatListTime(now - 59 * 60_000, now)).toBe('59m');
  });

  it('shows hours for earlier today', () => {
    expect(chatService.formatChatListTime(now - 2 * 3_600_000, now)).toBe('2h');
    expect(chatService.formatChatListTime(now - 5 * 3_600_000, now)).toBe('5h');
  });

  it('shows a compact date for yesterday or earlier', () => {
    // 11pm the previous calendar day — only 13h ago but a different day.
    expect(chatService.formatChatListTime(new Date('2024-06-14T23:00:00').getTime(), now)).toBe('Jun 14');
  });

  it('includes the year for a different year', () => {
    expect(chatService.formatChatListTime(new Date('2023-12-31T10:00:00').getTime(), now)).toBe('Dec 31, 2023');
  });
});

describe('formatRequestTime', () => {
  it('formats a timestamp as a 12-hour clock time', () => {
    const ts = new Date('2024-01-01T13:05:00').getTime();
    expect(chatService.formatRequestTime(ts)).toBe('1:05 PM');
  });
});

describe('formatCallDuration', () => {
  it.each([
    [0, '0:00'],
    [9_000, '0:09'],
    [59_000, '0:59'],
    [60_000, '1:00'],
    [125_000, '2:05'],
    [3_600_000, '1:00:00'],
    [3_725_000, '1:02:05'],
  ])('%dms → %s', (ms, expected) => {
    expect(chatService.formatCallDuration(ms)).toBe(expected);
  });
});

describe('toMessageSegments', () => {
  const tld = '.paseo';
  const segments = (text: string, activeTld = tld) => chatService.toMessageSegments(text, activeTld);
  const joined = (text: string) =>
    segments(text)
      .map(segment => segment.text)
      .join('');

  it('keeps text without links as one text segment', () => {
    expect(segments('just a message')).toEqual([{ type: 'text', text: 'just a message' }]);
  });

  it('turns a product invitation URL into a product link with its query', () => {
    expect(segments('join https://coff3r.paseo.li/?invite=abc please')).toEqual([
      { type: 'text', text: 'join ' },
      {
        type: 'product',
        text: 'https://coff3r.paseo.li/?invite=abc',
        target: { identifier: 'coff3r.paseo', pathname: '?invite=abc' },
      },
      { type: 'text', text: ' please' },
    ]);
  });

  it.each([
    ['coff3r.paseo', 'coff3r.paseo', ''],
    ['polkadot://coff3r.paseo/x', 'coff3r.paseo', 'x'],
    ['http://coff3r.paseo.li', 'coff3r.paseo', ''],
  ])('treats %s as a product link', (text, identifier, pathname) => {
    expect(segments(text)).toEqual([{ type: 'product', text, target: { identifier, pathname } }]);
  });

  it('leaves surrounding punctuation as text', () => {
    expect(segments('(see coff3r.paseo).')).toEqual([
      { type: 'text', text: '(see ' },
      { type: 'product', text: 'coff3r.paseo', target: { identifier: 'coff3r.paseo', pathname: '' } },
      { type: 'text', text: ').' },
    ]);
  });

  it('turns an https URL that names no product into an external link', () => {
    expect(segments('https://example.com/a?b=1')).toEqual([
      { type: 'external', text: 'https://example.com/a?b=1', href: 'https://example.com/a?b=1' },
    ]);
  });

  it("treats another network's gateway URL as an external link", () => {
    expect(segments('https://coff3r.dot.li')).toEqual([
      { type: 'external', text: 'https://coff3r.dot.li', href: 'https://coff3r.dot.li/' },
    ]);
  });

  it.each(['http://example.com', 'example.com', 'http://localhost:3000', 'localhost:3000'])('keeps %s as text', text => {
    expect(segments(text)).toEqual([{ type: 'text', text }]);
  });

  it('preserves whitespace and newlines verbatim', () => {
    const text = 'a\nhttps://example.com\n\nb';
    expect(joined(text)).toBe(text);
    expect(segments(text).map(segment => segment.type)).toEqual(['text', 'external', 'text']);
  });
});

describe('findCancelledRequest', () => {
  const cancelled = (requestId: string, peerId: string, timestamp: number): P2PChatRequest => ({
    requestId,
    peerId,
    peerUsername: 'mysticRiver.88',
    direction: 'incoming',
    status: 'cancelled',
    timestamp,
    userId: '0xuser',
    lastUpdate: 0,
  });

  const older = cancelled('req-1', '0xpeer', 1_000);
  const newer = cancelled('req-2', '0xpeer', 2_000);

  it('returns the newest cancelled request of the peer', () => {
    expect(chatService.findCancelledRequest([newer, older], '0xpeer')).toBe(newer);
    expect(chatService.findCancelledRequest([older, newer], '0xpeer')).toBe(newer);
  });

  it('ignores a request of the peer that is not a cancelled incoming one', () => {
    const pending: P2PChatRequest = { ...cancelled('req-3', '0xpeer', 3_000), status: 'pending' };
    const outgoing: P2PChatRequest = { ...cancelled('req-4', '0xpeer', 4_000), direction: 'outgoing' };

    expect(chatService.findCancelledRequest([older, pending, outgoing], '0xpeer')).toBe(older);
    expect(chatService.findCancelledRequest([pending, outgoing], '0xpeer')).toBeNull();
  });

  it('returns null for another peer', () => {
    expect(chatService.findCancelledRequest([older, newer], '0xother')).toBeNull();
  });

  it('returns null for a null peer', () => {
    expect(chatService.findCancelledRequest([older, newer], null)).toBeNull();
  });
});

describe('chooseRoomPane', () => {
  const request = (requestId: string, direction: P2PChatRequest['direction']): P2PChatRequest => ({
    requestId,
    peerId: '0xpeer',
    peerUsername: 'mysticRiver.88',
    direction,
    status: 'pending',
    timestamp: 1_000,
    userId: '0xuser',
    lastUpdate: 0,
  });

  const outgoing = request('req-out', 'outgoing');
  const incoming = request('req-in', 'incoming');
  const cancelled: P2PChatRequest = { ...request('req-cancelled', 'incoming'), status: 'cancelled' };
  const session: ChatSession = {
    sessionId: '0xpeer',
    roomId: '0xpeer',
    name: NEVER,
    messages: NEVER,
    lastMessage: NEVER,
    unreadCount: NEVER,
    participants: NEVER,
    sendMessage: async () => ({ messageId: 'm' }),
    markAsRead: async () => {},
    deleteSession: async () => {},
  };
  const none = { hasDraft: false, outgoing: null, incoming: null, session: null, cancelled: null };

  it('is empty when nothing is selected', () => {
    expect(chatService.chooseRoomPane(none)).toEqual({ kind: 'empty' });
  });

  it('shows the cancelled request when it is all there is', () => {
    expect(chatService.chooseRoomPane({ ...none, cancelled })).toEqual({ kind: 'cancelled', request: cancelled });
  });

  it('prefers a session over a cancelled request', () => {
    expect(chatService.chooseRoomPane({ ...none, session, cancelled })).toEqual({ kind: 'session', session });
  });

  it('prefers an incoming request over a session', () => {
    expect(chatService.chooseRoomPane({ ...none, incoming, session })).toEqual({ kind: 'incoming', request: incoming });
  });

  it('prefers an outgoing request over an incoming one', () => {
    expect(chatService.chooseRoomPane({ ...none, outgoing, incoming })).toEqual({ kind: 'outgoing', request: outgoing });
  });

  it('prefers the draft over everything', () => {
    expect(chatService.chooseRoomPane({ hasDraft: true, outgoing, incoming, session, cancelled })).toEqual({
      kind: 'draft',
    });
  });
});
