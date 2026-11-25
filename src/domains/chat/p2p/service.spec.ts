import { x25519 } from '@noble/curves/ed25519.js';
import { describe, expect, it } from 'vitest';

import { type ChatMessage, type MessageContent } from '../session/types';

import { p2pService } from './service';
import { type P2PChatRequest, type P2PRoom } from './types';

const SECRET_A = new Uint8Array(32).fill(0x01);
const SECRET_B = new Uint8Array(32).fill(0x02);
const SECRET_C = new Uint8Array(32).fill(0x03);

const keypair = (secret: Uint8Array) => ({
  privateKey: secret,
  publicKey: x25519.getPublicKey(secret),
});

describe('computeSharedSecret', () => {
  it('returns 32 bytes', () => {
    const alice = keypair(SECRET_A);
    const bob = keypair(SECRET_B);
    expect(p2pService.computeSharedSecret(alice.privateKey, bob.publicKey)).toHaveLength(32);
  });

  it('is symmetric — ECDH property: alice→bob equals bob→alice', () => {
    const alice = keypair(SECRET_A);
    const bob = keypair(SECRET_B);
    const aliceShared = p2pService.computeSharedSecret(alice.privateKey, bob.publicKey);
    const bobShared = p2pService.computeSharedSecret(bob.privateKey, alice.publicKey);
    expect(aliceShared).toEqual(bobShared);
  });

  it('different peers yield different shared secrets', () => {
    const alice = keypair(SECRET_A);
    const bob = keypair(SECRET_B);
    const charlie = keypair(SECRET_C);
    expect(p2pService.computeSharedSecret(alice.privateKey, bob.publicKey)).not.toEqual(
      p2pService.computeSharedSecret(alice.privateKey, charlie.publicKey),
    );
  });

  it('is deterministic', () => {
    const alice = keypair(SECRET_A);
    const bob = keypair(SECRET_B);
    const first = p2pService.computeSharedSecret(alice.privateKey, bob.publicKey);
    const second = p2pService.computeSharedSecret(alice.privateKey, bob.publicKey);
    expect(first).toEqual(second);
  });
});

const request = (direction: P2PChatRequest['direction'], status: P2PChatRequest['status']): P2PChatRequest => ({
  requestId: `${direction}-${status}`,
  peerId: 'peer',
  direction,
  status,
  timestamp: 0,
  userId: 'me',
  lastUpdate: 0,
});

describe('isPendingIncomingRequest', () => {
  it('is true only for pending incoming requests', () => {
    expect(p2pService.isPendingIncomingRequest(request('incoming', 'pending'))).toBe(true);
    expect(p2pService.isPendingIncomingRequest(request('incoming', 'accepted'))).toBe(false);
    expect(p2pService.isPendingIncomingRequest(request('outgoing', 'pending'))).toBe(false);
  });
});

describe('isPendingOutgoingRequest', () => {
  it('is true only for pending outgoing requests', () => {
    expect(p2pService.isPendingOutgoingRequest(request('outgoing', 'pending'))).toBe(true);
    expect(p2pService.isPendingOutgoingRequest(request('outgoing', 'declined'))).toBe(false);
    expect(p2pService.isPendingOutgoingRequest(request('incoming', 'pending'))).toBe(false);
  });
});

describe('isCancelledIncomingRequest', () => {
  it('is true only for an incoming cancelled request', () => {
    expect(p2pService.isCancelledIncomingRequest(request('incoming', 'cancelled'))).toBe(true);
    expect(p2pService.isCancelledIncomingRequest(request('outgoing', 'cancelled'))).toBe(false);
    expect(p2pService.isCancelledIncomingRequest(request('incoming', 'removed'))).toBe(false);
  });
});

describe('resolveIncomingCancel', () => {
  const cancel = { requestId: 'r1', peerId: 'peer', timestamp: 10 };

  const row = (
    direction: P2PChatRequest['direction'],
    status: P2PChatRequest['status'],
    overrides: Partial<P2PChatRequest> = {},
  ): P2PChatRequest => ({ ...request(direction, status), requestId: 'r1', timestamp: 5, ...overrides });

  const room = (isBlocked: boolean): P2PRoom => ({
    sessionId: 's1',
    peerId: 'peer',
    peerUsername: 'Peer',
    userId: 'me',
    createdAt: 0,
    isBlocked,
    lastUpdate: 0,
  });

  const message = (messageId: string, content: MessageContent): ChatMessage => ({
    messageId,
    sessionId: 's1',
    peer: { type: 'p2p', accountId: 'peer', name: 'Peer' },
    timestamp: 0,
    content,
    status: { direction: 'incoming', state: 'new' },
  });

  const requestSystemMessages: ChatMessage[] = [
    message('r1', { type: 'text', text: 'Hi!' }),
    message('m-contact', { type: 'contactAdded' }),
    message('m-accepted', {
      type: 'deviceChatAccepted',
      requestId: 'r1',
      statementAccountId: '0x01',
      encryptionPublicKey: '0x02',
    }),
    message('m-token', { type: 'token', token: 'ab', platform: 'iOS' }),
    message('m-left', { type: 'leftChat' }),
  ];

  const resolve = (
    request: P2PChatRequest | undefined,
    roomValue: P2PRoom | undefined = undefined,
    messages: ChatMessage[] = [],
  ) => p2pService.resolveIncomingCancel({ cancel, request, room: roomValue, messages });

  it('tombstones a cancel with no request row', () => {
    expect(resolve(undefined)).toBe('tombstone');
  });

  it('cancels a pending incoming request from the same peer with an older timestamp', () => {
    expect(resolve(row('incoming', 'pending'))).toBe('cancelPending');
  });

  it('ignores a cancel whose timestamp is not greater than the request', () => {
    expect(resolve(row('incoming', 'pending', { timestamp: 10 }))).toBe('ignore');
  });

  it('ignores a cancel from another peer', () => {
    expect(resolve(row('incoming', 'pending', { peerId: 'other' }))).toBe('ignore');
  });

  it('cancels an accepted request whose room holds only request-system rows', () => {
    expect(resolve(row('incoming', 'accepted'), room(false), requestSystemMessages)).toBe('cancelAccepted');
  });

  it('cancels an accepted request with no room', () => {
    expect(resolve(row('incoming', 'accepted'), undefined, requestSystemMessages)).toBe('cancelAccepted');
  });

  it('ignores an accepted request once the room holds another text message', () => {
    const messages = [...requestSystemMessages, message('m-text', { type: 'text', text: 'Hello' })];

    expect(resolve(row('incoming', 'accepted'), room(false), messages)).toBe('ignore');
  });

  it('ignores an accepted request once the room holds a reaction', () => {
    const messages = [...requestSystemMessages, message('m-reacted', { type: 'reacted', messageId: 'r1', emoji: '👍' })];

    expect(resolve(row('incoming', 'accepted'), room(false), messages)).toBe('ignore');
  });

  it('ignores an accepted request whose room is blocked', () => {
    expect(resolve(row('incoming', 'accepted'), room(true), requestSystemMessages)).toBe('ignore');
  });

  it('ignores a declined, cancelled, removed or outgoing request', () => {
    expect(resolve(row('incoming', 'declined'))).toBe('ignore');
    expect(resolve(row('incoming', 'cancelled'))).toBe('ignore');
    expect(resolve(row('incoming', 'removed'))).toBe('ignore');
    expect(resolve(row('outgoing', 'pending'))).toBe('ignore');
  });
});

describe('isRequestMessageHidden', () => {
  const withMessage = (overrides: Partial<P2PChatRequest> = {}): P2PChatRequest => ({
    ...request('incoming', 'pending'),
    welcomeMessage: 'Hi!',
    ...overrides,
  });

  it('hides a message when hiding is on and it is not revealed', () => {
    expect(p2pService.isRequestMessageHidden(withMessage(), true)).toBe(true);
  });

  it('does not hide once revealed', () => {
    expect(p2pService.isRequestMessageHidden(withMessage({ revealed: true }), true)).toBe(false);
  });

  it('does not hide when hiding is off', () => {
    expect(p2pService.isRequestMessageHidden(withMessage(), false)).toBe(false);
  });

  it('does not hide when there is no message', () => {
    expect(p2pService.isRequestMessageHidden(withMessage({ welcomeMessage: undefined }), true)).toBe(false);
  });
});

describe('seen receipt rules', () => {
  const build = (messageId: string, content: MessageContent, status: ChatMessage['status'], timestamp = 0): ChatMessage => ({
    messageId,
    sessionId: 's1',
    peer: { type: 'p2p', accountId: 'peer', name: 'Peer' },
    timestamp,
    content,
    status,
  });

  const incomingSeen: ChatMessage['status'] = { direction: 'incoming', state: 'seen' };
  const incomingNew: ChatMessage['status'] = { direction: 'incoming', state: 'new' };
  const outgoing = (state: 'new' | 'sent' | 'delivered'): ChatMessage['status'] => ({ direction: 'outgoing', state });

  const text: MessageContent = { type: 'text', text: 'hi' };

  describe('countsForSeenReceipt', () => {
    const counts = (content: MessageContent, status: ChatMessage['status'] = incomingSeen) =>
      p2pService.countsForSeenReceipt(build('m', content, status));

    it.each<[string, MessageContent]>([
      ['text', text],
      ['richText', { type: 'richText', text: 'hi' }],
      ['reply', { type: 'reply', messageId: 'x', content: text }],
      ['legacy transfer', { type: 'transfer', kind: 'legacy', amount: 1n }],
      ['coinage transfer', { type: 'transfer', kind: 'coinage', amount: 1n }],
      ['callSignal offer', { type: 'callSignal', signal: 'offer' }],
      ['callSignal answer', { type: 'callSignal', signal: 'answer' }],
      ['callSignal closed', { type: 'callSignal', signal: 'closed' }],
    ])('counts a seen incoming %s', (_name, content) => {
      expect(counts(content)).toBe(true);
    });

    it.each<[string, MessageContent]>([
      ['callSignal ice', { type: 'callSignal', signal: 'ice' }],
      ['reacted', { type: 'reacted', messageId: 'x', emoji: 'a' }],
      ['reactionRemoved', { type: 'reactionRemoved', messageId: 'x', emoji: 'a' }],
      ['edit', { type: 'edit', messageId: 'x', newContent: { type: 'richText', text: 'e' } }],
      ['contactAdded', { type: 'contactAdded' }],
      ['leftChat', { type: 'leftChat' }],
      ['token', { type: 'token', token: 'ab', platform: 'iOS' }],
      [
        'deviceChatAccepted',
        { type: 'deviceChatAccepted', requestId: 'r', statementAccountId: '0x1', encryptionPublicKey: '0x2' },
      ],
      ['deviceAdded', { type: 'deviceAdded', statementAccountId: '0x1', encryptionPublicKey: '0x2' }],
      ['custom', { type: 'custom', messageType: 't', payload: new Uint8Array() }],
    ])('does not count %s', (_name, content) => {
      expect(counts(content)).toBe(false);
    });

    it('does not count an incoming text that is still new', () => {
      expect(counts(text, incomingNew)).toBe(false);
    });

    it('does not count an outgoing text', () => {
      expect(counts(text, outgoing('delivered'))).toBe(false);
    });
  });

  describe('findLastSeenMessage', () => {
    it('returns the counted message with the greatest position', () => {
      const early = build('a', text, incomingSeen, 1);
      const last = build('b', text, incomingSeen, 2);
      const reaction = build('c', { type: 'reacted', messageId: 'a', emoji: 'x' }, incomingSeen, 5);
      const unseen = build('d', text, incomingNew, 6);

      expect(p2pService.findLastSeenMessage([early, reaction, last, unseen])).toBe(last);
    });

    it('breaks a timestamp tie by the greater messageId', () => {
      const low = build('a', text, incomingSeen, 3);
      const high = build('b', text, incomingSeen, 3);

      expect(p2pService.findLastSeenMessage([high, low])).toBe(high);
      expect(p2pService.findLastSeenMessage([low, high])).toBe(high);
    });

    it('returns null when nothing counts', () => {
      expect(p2pService.findLastSeenMessage([build('a', text, incomingNew, 1)])).toBeNull();
      expect(p2pService.findLastSeenMessage([])).toBeNull();
    });
  });

  describe('resolvePeerSeen', () => {
    it('resolves an outgoing message by id to its own position, also while new', () => {
      const messages = [build('a', text, outgoing('delivered'), 1), build('b', text, outgoing('new'), 9)];

      expect(p2pService.resolvePeerSeen(messages, { messageId: 'b', timestamp: 2 })).toEqual({
        timestamp: 9,
        messageId: 'b',
      });
    });

    it('does not match an incoming message by id', () => {
      const messages = [build('a', text, outgoing('sent'), 1), build('b', text, incomingSeen, 9)];

      expect(p2pService.resolvePeerSeen(messages, { messageId: 'b', timestamp: 5 })).toEqual({
        timestamp: 1,
        messageId: 'a',
      });
    });

    it('falls back to the greatest sent or delivered outgoing message not after the timestamp', () => {
      const messages = [
        build('a', text, outgoing('sent'), 1),
        build('b', text, outgoing('delivered'), 4),
        build('c', text, outgoing('new'), 5),
        build('d', text, outgoing('delivered'), 8),
      ];

      expect(p2pService.resolvePeerSeen(messages, { messageId: 'unknown', timestamp: 6 })).toEqual({
        timestamp: 4,
        messageId: 'b',
      });
    });

    it('breaks a timestamp tie by the greater messageId', () => {
      const messages = [build('b', text, outgoing('delivered'), 4), build('a', text, outgoing('delivered'), 4)];

      expect(p2pService.resolvePeerSeen(messages, { messageId: 'unknown', timestamp: 4 })).toEqual({
        timestamp: 4,
        messageId: 'b',
      });
    });

    it('returns null when nothing resolves', () => {
      const messages = [build('a', text, outgoing('new'), 1), build('b', text, outgoing('sent'), 9)];

      expect(p2pService.resolvePeerSeen(messages, { messageId: 'unknown', timestamp: 5 })).toBeNull();
    });
  });
});
