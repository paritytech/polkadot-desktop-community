import { Tooltip } from '@novasamatech/tr-ui';

import { TEST_IDS } from '@/shared/test-ids';
import { cnTw } from '@/shared/utils';
import { type ReactionAggregate } from '@/domains/chat';

type ReactionPillsProps = {
  reactions: ReactionAggregate[];
  onToggleReaction: (emoji: string) => void;
};

export const ReactionPills = ({ reactions, onToggleReaction }: ReactionPillsProps) => {
  if (reactions.length === 0) return null;

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="flex gap-1 px-2">
        {reactions.map(reaction => (
          <Tooltip key={reaction.emoji}>
            <Tooltip.Trigger asChild>
              <button
                data-testid={TEST_IDS.chatReactionPill}
                className={cnTw(
                  'flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs transition-colors',
                  'border shadow-xs',
                  reaction.reactedByMe
                    ? 'border-bg-surface-container-inverted bg-bg-surface-container-inverted text-fg-primary-inverted'
                    : 'border-border-primary bg-bg-surface-nested text-fg-primary hover:bg-bg-selection-container-hover',
                )}
                onClick={() => onToggleReaction(reaction.emoji)}
              >
                <span>{reaction.emoji}</span>
                {reaction.count > 1 && <span className="min-w-3 text-center text-[11px] leading-4">{reaction.count}</span>}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content side="top" sideOffset={4}>
              {reaction.reactors.map(r => (r.isMe ? 'You' : r.name)).join(', ')}
            </Tooltip.Content>
          </Tooltip>
        ))}
      </div>
    </Tooltip.Provider>
  );
};
