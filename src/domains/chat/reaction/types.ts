// src/domains/chat/reaction/types.ts

export type ReactorInfo = {
  name: string;
  isMe: boolean;
};

export type ReactionAggregate = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  reactors: ReactorInfo[];
};
