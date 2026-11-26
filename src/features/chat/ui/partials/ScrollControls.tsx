import { ChevronDown, Heart } from 'lucide-react';
import { type PropsWithChildren } from 'react';

import { TEST_IDS } from '@/shared/test-ids';
import { cnTw } from '@/shared/utils';

type ScrollControlsProps = {
  isAtBottom: boolean;
  unreadCount: number;
  unreadReactionCount: number;
  onScrollToBottom: () => void;
  onScrollToReaction: () => void;
};

export const ScrollControls = ({
  isAtBottom,
  unreadCount,
  unreadReactionCount,
  onScrollToBottom,
  onScrollToReaction,
}: ScrollControlsProps) => {
  const showChevron = !isAtBottom;
  const showHeart = unreadReactionCount > 0;

  if (!showChevron && !showHeart) return null;

  return (
    <div className="pointer-events-none absolute end-6 bottom-4 flex flex-col items-center gap-3">
      {showHeart && (
        <FabButton testId={TEST_IDS.chatUnreadReactionsButton} count={unreadReactionCount} onClick={onScrollToReaction}>
          <Heart className="size-5 text-fg-secondary" />
        </FabButton>
      )}
      {showChevron && (
        <FabButton testId={TEST_IDS.chatScrollToBottomButton} count={unreadCount} onClick={onScrollToBottom}>
          <ChevronDown className="size-5 text-fg-secondary" />
        </FabButton>
      )}
    </div>
  );
};

type FabButtonProps = PropsWithChildren<{
  testId: string;
  count: number;
  onClick: () => void;
}>;

const FabButton = ({ testId, count, onClick, children }: FabButtonProps) => (
  <button
    data-testid={testId}
    className={cnTw(
      'pointer-events-auto relative flex size-control items-center justify-center rounded-full',
      'border border-stroke-primary bg-bg-surface-container shadow-[0px_4px_12px_var(--shadow-soft)]',
      'transition-colors hover:bg-bg-selection-container-hover',
    )}
    onClick={onClick}
  >
    {children}
    {count > 0 && (
      <span className="absolute end-1 -top-1 min-w-4 rounded-full bg-bg-action-primary px-1 text-center text-2xs font-medium text-fg-primary-inverted">
        {count}
      </span>
    )}
  </button>
);
