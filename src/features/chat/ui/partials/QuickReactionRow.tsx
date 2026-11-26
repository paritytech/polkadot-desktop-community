import { Plus } from 'lucide-react';

import { TEST_IDS } from '@/shared/test-ids';

import { QUICK_REACTIONS } from './emoji-data';

type QuickReactionRowProps = {
  onSelectEmoji: (emoji: string) => void;
  onOpenFullPicker: VoidFunction;
};

export const QuickReactionRow = ({ onSelectEmoji, onOpenFullPicker }: QuickReactionRowProps) => {
  return (
    <div
      data-testid={TEST_IDS.chatQuickReactionsRow}
      className="flex items-center gap-0.5 rounded-full border border-stroke-primary bg-bg-surface-container px-1.5 py-1 shadow-[0px_4px_12px_var(--shadow-soft)]"
    >
      {QUICK_REACTIONS.map(emoji => (
        <button
          key={emoji}
          className="flex size-8 items-center justify-center rounded-full transition-all hover:scale-125"
          onClick={() => onSelectEmoji(emoji)}
        >
          <span className="text-xl leading-none">{emoji}</span>
        </button>
      ))}
      <button
        data-testid={TEST_IDS.chatEmojiPickerOpenButton}
        className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-bg-selection-container-hover"
        onClick={onOpenFullPicker}
      >
        <Plus className="size-4 text-fg-secondary" />
      </button>
    </div>
  );
};
