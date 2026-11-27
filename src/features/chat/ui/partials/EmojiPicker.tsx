import { useRef, useState } from 'react';

import XIcon from '@/shared/assets/images/icons/x.svg?jsx';
import { IconButton, SectionLabel } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';

import { EMOJI_CATEGORIES } from './emoji-data';

type EmojiPickerProps = {
  onSelect: (emoji: string) => void;
  onClose: VoidFunction;
};

export const EmojiPicker = ({ onSelect, onClose }: EmojiPickerProps) => {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState(0);
  const categoryRefs = useRef<(HTMLDivElement | null)[]>([]);

  const scrollToCategory = (index: number) => {
    setActiveCategory(index);
    categoryRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div data-testid={TEST_IDS.chatEmojiPicker} className="flex h-96 w-80 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center border-b border-stroke-primary px-2 py-1.5">
        <div className="flex flex-1 gap-0.5 overflow-x-auto">
          {EMOJI_CATEGORIES.map((category, index) => (
            <IconButton
              key={category.name}
              size="sm"
              label={category.name}
              aria-pressed={activeCategory === index}
              onClick={() => scrollToCategory(index)}
            >
              <span aria-hidden className="text-xs leading-none">
                {category.emojis[0]}
              </span>
            </IconButton>
          ))}
        </div>
        <span className="ms-1 flex shrink-0">
          <IconButton size="sm" label={t('common.aria.close')} onClick={onClose}>
            <XIcon />
          </IconButton>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-1">
        {EMOJI_CATEGORIES.map((category, catIndex) => (
          <div
            key={category.name}
            ref={el => {
              categoryRefs.current[catIndex] = el;
            }}
          >
            <div className="sticky top-0 bg-chrome-surface py-1">
              <SectionLabel>{category.name}</SectionLabel>
            </div>
            <div className="grid grid-cols-8 gap-0.5">
              {category.emojis.map((emoji, emojiIndex) => (
                // eslint-disable-next-line react/no-array-index-key -- a static list that repeats some emojis; the index tells the repeats apart
                <IconButton key={`${emoji}-${emojiIndex}`} label={emoji} onClick={() => onSelect(emoji)}>
                  <span aria-hidden className="text-xl leading-none">
                    {emoji}
                  </span>
                </IconButton>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
