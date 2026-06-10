import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cnTw } from '@/shared/utils';

import { EMOJI_CATEGORIES } from './emoji-data';

type EmojiPickerProps = {
  onSelect: (emoji: string) => void;
  onClose: VoidFunction;
};

export const EmojiPicker = ({ onSelect, onClose }: EmojiPickerProps) => {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState(0);
  const categoryRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const scrollToCategory = (index: number) => {
    setActiveCategory(index);
    categoryRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      ref={pickerRef}
      data-emoji-picker
      className="flex h-96 w-80 flex-col overflow-hidden rounded-xl border border-border-primary bg-bg-surface-container shadow-lg"
    >
      {/* Header with category tabs and close button */}
      <div className="flex shrink-0 items-center border-b border-border-primary px-2 py-1.5">
        <div className="flex flex-1 gap-0.5 overflow-x-auto">
          {EMOJI_CATEGORIES.map((category, index) => (
            <button
              key={category.name}
              className={cnTw(
                'shrink-0 rounded px-2 py-1 text-xs transition-colors',
                activeCategory === index
                  ? 'bg-bg-selection-container-active text-fg-primary'
                  : 'text-fg-tertiary hover:bg-bg-selection-container-hover',
              )}
              onClick={() => scrollToCategory(index)}
            >
              {category.emojis[0]}
            </button>
          ))}
        </div>
        <button
          className="ml-1 flex size-6 shrink-0 items-center justify-center rounded transition-colors hover:bg-bg-selection-container-hover"
          onClick={onClose}
        >
          <X className="size-3.5 text-fg-tertiary" />
        </button>
      </div>

      {/* Emoji grid */}
      <div className="flex-1 overflow-y-auto px-2 pb-1">
        {EMOJI_CATEGORIES.map((category, catIndex) => (
          <div
            key={category.name}
            ref={el => {
              categoryRefs.current[catIndex] = el;
            }}
          >
            <div className="sticky top-0 bg-bg-surface-container py-1 text-xs font-medium text-fg-tertiary">{category.name}</div>
            <div className="grid grid-cols-8 gap-0.5">
              {category.emojis.map(emoji => (
                <button
                  key={emoji}
                  className="flex size-9 items-center justify-center rounded transition-colors hover:bg-bg-selection-container-hover"
                  onClick={() => onSelect(emoji)}
                >
                  <span className="text-xl">{emoji}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
