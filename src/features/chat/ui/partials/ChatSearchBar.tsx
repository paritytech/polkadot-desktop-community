import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { type Ref } from 'react';

import { IconButton } from '@/shared/components';
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
      <div className="flex h-control min-w-0 flex-1 items-center gap-2 rounded-full bg-bg-action-secondary px-3">
        <Search strokeWidth={1.75} className="size-4 shrink-0 text-fg-tertiary" />
        <input
          ref={inputRef}
          type="text"
          data-no-app-focus
          value={query}
          /* eslint-disable-next-line formatjs/no-literal-string-in-jsx -- v1 search; not localized yet */
          placeholder="Search in chat..."
          className="min-w-0 flex-1 bg-transparent text-sm text-fg-primary outline-none placeholder:text-fg-tertiary"
          onChange={e => onQueryChange(e.target.value)}
        />
        {hasQuery && (
          <IconButton size="sm" label={t('common.aria.clear')} onClick={() => onQueryChange('')}>
            <X strokeWidth={1.75} />
          </IconButton>
        )}
        {canNavigate && (
          <span className="shrink-0 text-xs font-medium text-fg-tertiary">
            {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx -- numeric counter */}
            {resultIndex + 1} / {resultCount}
          </span>
        )}
      </div>
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
