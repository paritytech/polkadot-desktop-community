import { describe, expect, it } from 'vitest';

import { type ChatMessage } from '../session/types';

import { reactionService } from './service';

const makeMessage = (overrides: Partial<ChatMessage> & Pick<ChatMessage, 'messageId' | 'content'>): ChatMessage => ({
  sessionId: 'session-1',
  peer: { type: 'p2p', accountId: 'alice', name: 'Alice' },
  timestamp: Date.now(),
  status: { direction: 'incoming', state: 'new' },
  ...overrides,
});

describe('reactionService.aggregateReactions', () => {
  it('returns empty map when no reaction messages exist', () => {
    const messages: ChatMessage[] = [makeMessage({ messageId: 'msg-1', content: { type: 'text', text: 'hello' } })];
    const result = reactionService.aggregateReactions(messages);
    expect(result.size).toBe(0);
  });

  it('aggregates a single reaction', () => {
    const messages: ChatMessage[] = [
      makeMessage({ messageId: 'msg-1', content: { type: 'text', text: 'hello' } }),
      makeMessage({
        messageId: 'reaction-1',
        content: { type: 'reacted', messageId: 'msg-1', emoji: '👍' },
        peer: { type: 'p2p', accountId: 'bob', name: 'Bob' },
        status: { direction: 'incoming', state: 'new' },
      }),
    ];
    const result = reactionService.aggregateReactions(messages);
    const reactions = result.get('msg-1');
    expect(reactions).toHaveLength(1);
    expect(reactions![0]).toEqual({
      emoji: '👍',
      count: 1,
      reactedByMe: false,
      reactors: [{ name: 'Bob', isMe: false }],
    });
  });

  it('aggregates multiple reactions to same emoji', () => {
    const messages: ChatMessage[] = [
      makeMessage({ messageId: 'msg-1', content: { type: 'text', text: 'hello' } }),
      makeMessage({
        messageId: 'r-1',
        content: { type: 'reacted', messageId: 'msg-1', emoji: '👍' },
        peer: { type: 'p2p', accountId: 'bob', name: 'Bob' },
        status: { direction: 'incoming', state: 'new' },
      }),
      makeMessage({
        messageId: 'r-2',
        content: { type: 'reacted', messageId: 'msg-1', emoji: '👍' },
        status: { direction: 'outgoing', state: 'sent' },
      }),
    ];
    const result = reactionService.aggregateReactions(messages);
    const reactions = result.get('msg-1')!;
    expect(reactions).toHaveLength(1);
    expect(reactions.at(0)?.count).toBe(2);
    expect(reactions.at(0)?.reactedByMe).toBe(true);
  });

  it('handles reactionRemoved cancelling a reaction', () => {
    const messages: ChatMessage[] = [
      makeMessage({
        messageId: 'r-1',
        content: { type: 'reacted', messageId: 'msg-1', emoji: '👍' },
        peer: { type: 'p2p', accountId: 'bob', name: 'Bob' },
        status: { direction: 'incoming', state: 'new' },
        timestamp: 1000,
      }),
      makeMessage({
        messageId: 'r-2',
        content: { type: 'reactionRemoved', messageId: 'msg-1', emoji: '👍' },
        peer: { type: 'p2p', accountId: 'bob', name: 'Bob' },
        status: { direction: 'incoming', state: 'new' },
        timestamp: 2000,
      }),
    ];
    const result = reactionService.aggregateReactions(messages);
    expect(result.get('msg-1')).toBeUndefined();
  });

  it('enforces single reaction per peer — latest wins', () => {
    const messages: ChatMessage[] = [
      makeMessage({
        messageId: 'r-1',
        content: { type: 'reacted', messageId: 'msg-1', emoji: '👍' },
        peer: { type: 'p2p', accountId: 'bob', name: 'Bob' },
        status: { direction: 'incoming', state: 'new' },
        timestamp: 1000,
      }),
      makeMessage({
        messageId: 'r-2',
        content: { type: 'reacted', messageId: 'msg-1', emoji: '🔥' },
        peer: { type: 'p2p', accountId: 'bob', name: 'Bob' },
        status: { direction: 'incoming', state: 'new' },
        timestamp: 2000,
      }),
    ];
    const result = reactionService.aggregateReactions(messages);
    const reactions = result.get('msg-1')!;
    expect(reactions).toHaveLength(1);
    expect(reactions.at(0)?.emoji).toBe('🔥');
  });

  it('tracks outgoing reactions as reactedByMe', () => {
    const messages: ChatMessage[] = [
      makeMessage({
        messageId: 'r-1',
        content: { type: 'reacted', messageId: 'msg-1', emoji: '❤️' },
        status: { direction: 'outgoing', state: 'sent' },
      }),
    ];
    const result = reactionService.aggregateReactions(messages);
    const reactions = result.get('msg-1')!;
    expect(reactions.at(0)?.reactedByMe).toBe(true);
    expect(reactions.at(0)?.reactors.at(0)?.isMe).toBe(true);
  });

  it('groups different emojis separately', () => {
    const messages: ChatMessage[] = [
      makeMessage({
        messageId: 'r-1',
        content: { type: 'reacted', messageId: 'msg-1', emoji: '👍' },
        peer: { type: 'p2p', accountId: 'alice', name: 'Alice' },
        status: { direction: 'incoming', state: 'new' },
      }),
      makeMessage({
        messageId: 'r-2',
        content: { type: 'reacted', messageId: 'msg-1', emoji: '🔥' },
        status: { direction: 'outgoing', state: 'sent' },
      }),
    ];
    const result = reactionService.aggregateReactions(messages);
    const reactions = result.get('msg-1')!;
    expect(reactions).toHaveLength(2);
    expect(reactions.map(r => r.emoji)).toContain('👍');
    expect(reactions.map(r => r.emoji)).toContain('🔥');
  });
});
