import { type PropsWithChildren } from 'react';

import { IconButton } from '@/shared/components';
import { ChevronDownIcon, HeartIcon } from '@/shared/icons';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';

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
  const { t } = useTranslation();

  const showChevron = !isAtBottom;
  const showHeart = unreadReactionCount > 0;

  if (!showChevron && !showHeart) return null;

  return (
    <div className="pointer-events-none absolute end-6 bottom-4 flex flex-col items-center gap-3">
      {showHeart && (
        <FabButton
          testId={TEST_IDS.chatUnreadReactionsButton}
          label={t('feature.chat.scroll.toReaction')}
          count={unreadReactionCount}
          onClick={onScrollToReaction}
        >
          <HeartIcon />
        </FabButton>
      )}
      {showChevron && (
        <FabButton
          testId={TEST_IDS.chatScrollToBottomButton}
          label={t('feature.chat.scroll.toBottom')}
          count={unreadCount}
          onClick={onScrollToBottom}
        >
          <ChevronDownIcon />
        </FabButton>
      )}
    </div>
  );
};

type FabButtonProps = PropsWithChildren<{
  testId: string;
  label: string;
  count: number;
  onClick: () => void;
}>;

const FabButton = ({ testId, label, count, onClick, children }: FabButtonProps) => (
  <span className="pointer-events-auto relative flex">
    <IconButton variant="raised" label={label} data-testid={testId} onClick={onClick}>
      {children}
    </IconButton>
    {count > 0 && (
      <span className="pointer-events-none absolute end-1 -top-1 min-w-4 rounded-full bg-bg-action-primary px-1 text-center text-2xs font-medium text-fg-primary-inverted">
        {count}
      </span>
    )}
  </span>
);
