import { type ChatMessage } from '../session/types';

import { type ReactionAggregate, type ReactorInfo } from './types';

type PeerKey = string;

type PeerReaction = {
  emoji: string;
  timestamp: number;
  name: string;
  isMe: boolean;
};

const getPeerKey = (message: ChatMessage): PeerKey => {
  if (message.status.direction === 'outgoing') return '__me__';

  switch (message.peer.type) {
    case 'p2p':
      return message.peer.accountId;
    case 'user':
      return message.peer.accountId;
    case 'product':
      return message.peer.productId;
  }
};

const aggregateReactions = (messages: ChatMessage[]): Map<string, ReactionAggregate[]> => {
  const perMessage = new Map<string, Map<PeerKey, PeerReaction | null>>();

  for (const msg of messages) {
    if (msg.content.type !== 'reacted' && msg.content.type !== 'reactionRemoved') continue;

    const targetId = msg.content.messageId;
    const peerKey = getPeerKey(msg);
    const isMe = msg.status.direction === 'outgoing';

    let peerMap = perMessage.get(targetId);
    if (!peerMap) {
      peerMap = new Map();
      perMessage.set(targetId, peerMap);
    }

    const existing = peerMap.get(peerKey);

    if (existing !== undefined && existing !== null && msg.timestamp < existing.timestamp) continue;

    if (msg.content.type === 'reactionRemoved') {
      // Only remove if the emoji matches what's currently stored — a remove for an old emoji
      // should not cancel a newer reaction with a different emoji
      if (existing && existing.emoji === msg.content.emoji) {
        peerMap.set(peerKey, null);
      }
    } else {
      peerMap.set(peerKey, {
        emoji: msg.content.emoji,
        timestamp: msg.timestamp,
        name: msg.peer.name,
        isMe,
      });
    }
  }

  const result = new Map<string, ReactionAggregate[]>();

  for (const [targetId, peerMap] of perMessage) {
    const emojiGroups = new Map<string, { reactors: ReactorInfo[]; reactedByMe: boolean }>();

    for (const reaction of peerMap.values()) {
      if (reaction === null) continue;

      let group = emojiGroups.get(reaction.emoji);
      if (!group) {
        group = { reactors: [], reactedByMe: false };
        emojiGroups.set(reaction.emoji, group);
      }

      group.reactors.push({ name: reaction.name, isMe: reaction.isMe });
      if (reaction.isMe) group.reactedByMe = true;
    }

    if (emojiGroups.size === 0) continue;

    const aggregates: ReactionAggregate[] = [];
    for (const [emoji, group] of emojiGroups) {
      aggregates.push({
        emoji,
        count: group.reactors.length,
        reactedByMe: group.reactedByMe,
        reactors: group.reactors,
      });
    }

    result.set(targetId, aggregates);
  }

  return result;
};

export const reactionService = {
  aggregateReactions,
};
