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
      className="flex items-center gap-0.5 rounded-full border border-[#e5e5e5] bg-white px-1.5 py-1 shadow-[0px_4px_12px_rgba(0,0,0,0.12)]"
    >
      {QUICK_REACTIONS.map(emoji => (
        <button
          key={emoji}
          className="flex size-8 items-center justify-center rounded-full transition-all hover:scale-125"
          onClick={() => onSelectEmoji(emoji)}
        >
          <span className="text-[20px] leading-none">{emoji}</span>
        </button>
      ))}
      <button
        className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-[#f0f0f0]"
        onClick={onOpenFullPicker}
      >
        <Plus className="size-4 text-[#a3a3a3]" />
      </button>
    </div>
  );
};
