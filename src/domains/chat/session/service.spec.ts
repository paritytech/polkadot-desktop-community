import { describe, expect, it } from 'vitest';

import { chatMessageService } from './service';
import { type ChatMessage, type ChatMessageStatus, type MessageContent, type MessagePosition } from './types';

describe('chatMessageService.isSyncCarrier', () => {
  it('marks deviceChatAccepted as a sync carrier (never user-visible)', () => {
    const content: MessageContent = {
      type: 'deviceChatAccepted',
      requestId: 'req-1',
      statementAccountId: '0x01',
      encryptionPublicKey: '0x02',
    };

    expect(chatMessageService.isSyncCarrier(content)).toBe(true);
  });

  it('marks deviceAdded as a sync carrier (never user-visible)', () => {
    const content: MessageContent = {
      type: 'deviceAdded',
      statementAccountId: '0x01',
      encryptionPublicKey: '0x02',
    };

    expect(chatMessageService.isSyncCarrier(content)).toBe(true);
  });

  it('marks token as a sync carrier (peer push token — never user-visible)', () => {
    const content: MessageContent = {
      type: 'token',
      token: 'ab'.repeat(16),
      platform: 'Android',
    };

    expect(chatMessageService.isSyncCarrier(content)).toBe(true);
  });

  it('does not mark user-facing content as a sync carrier', () => {
    const visible: MessageContent[] = [
      { type: 'text', text: 'hi' },
      { type: 'contactAdded' },
      { type: 'leftChat' },
      { type: 'transfer', kind: 'coinage', amount: 1n },
    ];

    for (const content of visible) {
      expect(chatMessageService.isSyncCarrier(content)).toBe(false);
    }
  });
});

describe('chatMessageService.isStandaloneMessage', () => {
  it('accepts content that stands on its own in a conversation', () => {
    const standalone: MessageContent[] = [
      { type: 'text', text: 'hi' },
      { type: 'richText', text: 'rich' },
      { type: 'contactAdded' },
      { type: 'leftChat' },
      { type: 'transfer', kind: 'coinage', amount: 1n },
      { type: 'callSignal', signal: 'offer', purpose: 'audio' },
      { type: 'callSignal', signal: 'offer', purpose: 'video' },
    ];

    for (const content of standalone) {
      expect(chatMessageService.isStandaloneMessage(content)).toBe(true);
    }
  });

  it('rejects sync carriers — they replicate device metadata, not user content', () => {
    const carriers: MessageContent[] = [
      { type: 'deviceChatAccepted', requestId: 'req-1', statementAccountId: '0x01', encryptionPublicKey: '0x02' },
      { type: 'deviceAdded', statementAccountId: '0x01', encryptionPublicKey: '0x02' },
      { type: 'token', token: 'ab'.repeat(16), platform: 'Android' },
    ];

    for (const content of carriers) {
      expect(chatMessageService.isStandaloneMessage(content)).toBe(false);
    }
  });

  it('rejects non-offer call signals — they fold into the offer’s derived call state', () => {
    const signals: MessageContent[] = [
      { type: 'callSignal', signal: 'answer', offerMessageId: 'o1' },
      { type: 'callSignal', signal: 'ice', offerMessageId: 'o1' },
      { type: 'callSignal', signal: 'closed', offerMessageId: 'o1' },
    ];

    for (const content of signals) {
      expect(chatMessageService.isStandaloneMessage(content)).toBe(false);
    }
  });

  it('rejects reactions and edits — they modify a message rather than stand alone', () => {
    const modifiers: MessageContent[] = [
      { type: 'reacted', messageId: 'm1', emoji: '👍' },
      { type: 'reactionRemoved', messageId: 'm1', emoji: '👍' },
      { type: 'edit', messageId: 'm1', newContent: { type: 'richText', text: 'edited' } },
    ];

    for (const content of modifiers) {
      expect(chatMessageService.isStandaloneMessage(content)).toBe(false);
    }
  });
});

describe('chatMessageService.getSearchableText', () => {
  it('returns the body of text and richText content', () => {
    expect(chatMessageService.getSearchableText({ type: 'text', text: 'hello world' })).toBe('hello world');
    expect(chatMessageService.getSearchableText({ type: 'richText', text: 'rich body' })).toBe('rich body');
  });

  it('recurses into the quoted content of a reply', () => {
    const reply: MessageContent = {
      type: 'reply',
      messageId: 'm-1',
      content: { type: 'text', text: 'quoted text' },
    };

    expect(chatMessageService.getSearchableText(reply)).toBe('quoted text');
  });

  it('returns the new body of an edit', () => {
    const edit: MessageContent = {
      type: 'edit',
      messageId: 'm-1',
      newContent: { type: 'richText', text: 'edited body' },
    };

    expect(chatMessageService.getSearchableText(edit)).toBe('edited body');
  });

  it('returns empty string for content without searchable text', () => {
    const empty: MessageContent[] = [
      { type: 'contactAdded' },
      { type: 'leftChat' },
      { type: 'transfer', kind: 'coinage', amount: 1n },
      { type: 'deviceAdded', statementAccountId: '0x01', encryptionPublicKey: '0x02' },
    ];

    for (const content of empty) {
      expect(chatMessageService.getSearchableText(content)).toBe('');
    }
  });
});

describe('chatMessageService.shouldUpgradeStatus', () => {
  const incoming = (state: 'new' | 'seen'): ChatMessageStatus => ({ direction: 'incoming', state });
  const outgoing = (state: 'new' | 'sent' | 'delivered'): ChatMessageStatus => ({ direction: 'outgoing', state });

  it('upgrades incoming new → seen', () => {
    expect(chatMessageService.shouldUpgradeStatus(incoming('new'), incoming('seen'))).toBe(true);
  });

  it('refuses to regress incoming seen → new (the reload read-state bug)', () => {
    expect(chatMessageService.shouldUpgradeStatus(incoming('seen'), incoming('new'))).toBe(false);
  });

  it('upgrades outgoing sent → delivered', () => {
    expect(chatMessageService.shouldUpgradeStatus(outgoing('sent'), outgoing('delivered'))).toBe(true);
  });

  it('refuses to regress outgoing delivered → new', () => {
    expect(chatMessageService.shouldUpgradeStatus(outgoing('delivered'), outgoing('new'))).toBe(false);
  });

  it('refuses an identical re-write (no change)', () => {
    expect(chatMessageService.shouldUpgradeStatus(incoming('seen'), incoming('seen'))).toBe(false);
  });

  it('never crosses direction', () => {
    expect(chatMessageService.shouldUpgradeStatus(outgoing('new'), incoming('seen'))).toBe(false);
    expect(chatMessageService.shouldUpgradeStatus(incoming('new'), outgoing('delivered'))).toBe(false);
  });
});

describe('chatMessageService.compareMessagePositions', () => {
  it('puts an earlier timestamp first whatever the ids', () => {
    expect(
      chatMessageService.compareMessagePositions({ timestamp: 1, messageId: 'z' }, { timestamp: 2, messageId: 'a' }),
    ).toBeLessThan(0);
    expect(
      chatMessageService.compareMessagePositions({ timestamp: 2, messageId: 'a' }, { timestamp: 1, messageId: 'z' }),
    ).toBeGreaterThan(0);
  });

  it('breaks a timestamp tie by messageId in code-unit order, not locale order', () => {
    expect(
      chatMessageService.compareMessagePositions({ timestamp: 5, messageId: 'B' }, { timestamp: 5, messageId: 'a' }),
    ).toBeLessThan(0);
    expect(
      chatMessageService.compareMessagePositions({ timestamp: 5, messageId: 'a' }, { timestamp: 5, messageId: 'B' }),
    ).toBeGreaterThan(0);
  });

  it('gives 0 for identical positions', () => {
    expect(chatMessageService.compareMessagePositions({ timestamp: 5, messageId: 'm' }, { timestamp: 5, messageId: 'm' })).toBe(
      0,
    );
  });
});

describe('chatMessageService.isSeenByPeer', () => {
  const peerSeen: MessagePosition = { timestamp: 100, messageId: 'm' };

  const message = (timestamp: number, messageId: string, status: ChatMessageStatus): ChatMessage => ({
    messageId,
    sessionId: 's-1',
    peer: { type: 'p2p', accountId: 'peer', name: 'Peer' },
    timestamp,
    content: { type: 'text', text: 'hi' },
    status,
  });

  it('marks an outgoing sent or delivered message at the seen position as seen', () => {
    expect(chatMessageService.isSeenByPeer(message(100, 'm', { direction: 'outgoing', state: 'sent' }), peerSeen)).toBe(true);
    expect(chatMessageService.isSeenByPeer(message(100, 'm', { direction: 'outgoing', state: 'delivered' }), peerSeen)).toBe(
      true,
    );
  });

  it('marks an outgoing sent or delivered message before the seen position as seen', () => {
    expect(chatMessageService.isSeenByPeer(message(99, 'm', { direction: 'outgoing', state: 'sent' }), peerSeen)).toBe(true);
    expect(chatMessageService.isSeenByPeer(message(99, 'm', { direction: 'outgoing', state: 'delivered' }), peerSeen)).toBe(true);
  });

  it('does not mark an outgoing message after the seen position as seen', () => {
    expect(chatMessageService.isSeenByPeer(message(100, 'n', { direction: 'outgoing', state: 'delivered' }), peerSeen)).toBe(
      false,
    );
    expect(chatMessageService.isSeenByPeer(message(101, 'm', { direction: 'outgoing', state: 'delivered' }), peerSeen)).toBe(
      false,
    );
  });

  it('does not mark an outgoing message that is not yet sent as seen', () => {
    expect(chatMessageService.isSeenByPeer(message(50, 'm', { direction: 'outgoing', state: 'new' }), peerSeen)).toBe(false);
  });

  it('does not mark an incoming message as seen by the peer', () => {
    expect(chatMessageService.isSeenByPeer(message(50, 'm', { direction: 'incoming', state: 'seen' }), peerSeen)).toBe(false);
  });

  it('marks nothing as seen when the peer has seen nothing', () => {
    expect(chatMessageService.isSeenByPeer(message(50, 'm', { direction: 'outgoing', state: 'delivered' }), null)).toBe(false);
  });
});

describe('chatMessageService.positionOf', () => {
  it('positionOf takes the timestamp and messageId of the message', () => {
    const message: ChatMessage = {
      messageId: 'm-1',
      sessionId: 's-1',
      peer: { type: 'p2p', accountId: 'peer', name: 'Peer' },
      timestamp: 42,
      content: { type: 'text', text: 'hi' },
      status: { direction: 'outgoing', state: 'sent' },
    };

    expect(chatMessageService.positionOf(message)).toEqual({ timestamp: 42, messageId: 'm-1' });
  });
});
