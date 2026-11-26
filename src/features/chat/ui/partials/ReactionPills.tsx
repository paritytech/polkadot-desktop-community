import { Tooltip } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type ReactionAggregate } from '@/domains/chat';

type ReactionPillsProps = {
  reactions: ReactionAggregate[];
  // Reactions render inverted (dark) on the sender's own dark bubbles, light on incoming ones.
  isMe: boolean;
  onToggleReaction: (emoji: string) => void;
};

export const ReactionPills = ({ reactions, isMe, onToggleReaction }: ReactionPillsProps) => {
  const { t } = useTranslation();

  if (reactions.length === 0) return null;

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="flex gap-1">
        {reactions.map(reaction => (
          <Tooltip.Root key={reaction.emoji}>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                data-testid={TEST_IDS.chatReactionPill}
                data-no-app-focus
                className={cnTw(
                  'flex h-control-sm items-center gap-1 rounded-full border px-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chrome-focus',
                  isMe
                    ? cnTw(
                        'border-stroke-primary-inverted hover:bg-bg-selection-container-hover-inverted',
                        reaction.reactedByMe ? 'bg-bg-action-secondary-inverted' : 'bg-bg-surface-container-inverted',
                      )
                    : cnTw(
                        'border-stroke-secondary hover:bg-bg-selection-container-hover',
                        reaction.reactedByMe ? 'bg-bg-action-secondary' : 'bg-bg-surface-container',
                      ),
                )}
                onClick={() => onToggleReaction(reaction.emoji)}
              >
                <span className="text-base leading-none">{reaction.emoji}</span>
                {reaction.count > 1 && (
                  <span
                    className={cnTw('min-w-3 text-center text-2xs', isMe ? 'text-fg-secondary-inverted' : 'text-fg-secondary')}
                  >
                    {reaction.count}
                  </span>
                )}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content side="top" sideOffset={4}>
              {reaction.reactors.map(r => (r.isMe ? t('feature.chat.reactions.you') : r.name)).join(', ')}
            </Tooltip.Content>
          </Tooltip.Root>
        ))}
      </div>
    </Tooltip.Provider>
  );
};
