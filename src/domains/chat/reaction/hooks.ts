import { useCallback, useMemo } from 'react';

import { type ChatMessage, type ChatSession } from '../session/types';

import { reactionService } from './service';
import { type ReactionAggregate } from './types';

export function useMessageReactions(messages: ChatMessage[]): Map<string, ReactionAggregate[]> {
  return useMemo(() => reactionService.aggregateReactions(messages), [messages]);
}

export function useToggleReaction(session: ChatSession, messages: ChatMessage[]) {
  const reactions = useMessageReactions(messages);

  return useCallback(
    async (messageId: string, emoji: string) => {
      const existing = reactions.get(messageId);
      const myReaction = existing?.find(r => r.reactedByMe);

      // If I already reacted with this emoji, remove it
      if (myReaction?.emoji === emoji) {
        await session.sendMessage({ type: 'reactionRemoved', messageId, emoji });
        return;
      }

      // Send new reaction first, then remove old (matches iOS ordering)
      await session.sendMessage({ type: 'reacted', messageId, emoji });

      if (myReaction) {
        await session.sendMessage({ type: 'reactionRemoved', messageId, emoji: myReaction.emoji });
      }
    },
    [session, reactions],
  );
}
