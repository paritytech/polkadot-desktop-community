import PlusIcon from '@/shared/assets/images/icons/plus.svg?jsx';
import { IconButton } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';

import { QUICK_REACTIONS } from './emoji-data';

type QuickReactionRowProps = {
  onSelectEmoji: (emoji: string) => void;
  onOpenFullPicker: VoidFunction;
};

export const QuickReactionRow = ({ onSelectEmoji, onOpenFullPicker }: QuickReactionRowProps) => {
  const { t } = useTranslation();

  return (
    <div data-testid={TEST_IDS.chatQuickReactionsRow} className="flex items-center gap-1 px-1 pb-1">
      {QUICK_REACTIONS.map(emoji => (
        <IconButton key={emoji} label={emoji} onClick={() => onSelectEmoji(emoji)}>
          <span aria-hidden className="text-xl leading-none">
            {emoji}
          </span>
        </IconButton>
      ))}
      <IconButton
        data-testid={TEST_IDS.chatEmojiPickerOpenButton}
        label={t('feature.chat.moreReactions')}
        onClick={onOpenFullPicker}
      >
        <PlusIcon />
      </IconButton>
    </div>
  );
};
