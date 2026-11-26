import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { type Ref } from 'react';

import { IconButton, Input } from '@/shared/components';
import { useTranslation } from '@/shared/translation';

type Props = {
  query: string;
  inputRef?: Ref<HTMLInputElement>;
  resultCount: number;
  resultIndex: number;
  onQueryChange(value: string): void;
  onPrev(): void;
  onNext(): void;
  onClose(): void;
};

export const ChatSearchBar = ({ query, inputRef, resultCount, resultIndex, onQueryChange, onPrev, onNext, onClose }: Props) => {
  const { t } = useTranslation();
  const hasQuery = query.trim().length > 0;
  const hasResults = resultCount > 0;
  const canNavigate = hasQuery && hasResults;

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-stroke-primary bg-bg-surface-container px-2">
      <Input
        ref={inputRef}
        leading={<Search />}
        type="text"
        value={query}
        placeholder={t('feature.chat.inChatSearch.placeholder')}
        aria-label={t('feature.chat.inChatSearch.placeholder')}
        trailing={
          <>
            {canNavigate && (
              <span className="text-2xs text-chrome-muted tabular-nums">
                {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx -- numeric counter */}
                {resultIndex + 1} / {resultCount}
              </span>
            )}
            {hasQuery && (
              <IconButton size="sm" label={t('common.aria.clear')} onClick={() => onQueryChange('')}>
                <X strokeWidth={1.75} />
              </IconButton>
            )}
          </>
        }
        onChange={e => onQueryChange(e.target.value)}
      />
      <IconButton label={t('feature.chat.searchPrevious')} disabled={!canNavigate} onClick={onPrev}>
        <ChevronUp strokeWidth={1.75} />
      </IconButton>
      <IconButton label={t('feature.chat.searchNext')} disabled={!canNavigate} onClick={onNext}>
        <ChevronDown strokeWidth={1.75} />
      </IconButton>
      <IconButton label={t('common.aria.close')} onClick={onClose}>
        <X strokeWidth={1.75} />
      </IconButton>
    </div>
  );
};
