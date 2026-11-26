import { Search, X } from 'lucide-react';
import { type Ref } from 'react';

import { IconButton } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';

type Props = {
  query: string;
  active: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onQueryChange(value: string): void;
  onFocus(): void;
  onClear(): void;
  onEscape(): void;
};

export const ChatListSearchBar = ({ query, active, inputRef, onQueryChange, onFocus, onClear, onEscape }: Props) => {
  const { t } = useTranslation();

  return (
    <div className="shrink-0 px-2 pb-2">
      <div className="flex h-control items-center gap-2 rounded-md border border-stroke-primary bg-bg-surface-nested px-3">
        <Search strokeWidth={1.75} className="size-5 shrink-0 text-fg-tertiary" />
        <input
          ref={inputRef}
          type="text"
          data-testid={TEST_IDS.contactSearchInput}
          data-no-app-focus
          value={query}
          placeholder={t('feature.chat.searchByUsernameOrMessages')}
          className="min-w-0 flex-1 bg-transparent text-sm text-fg-primary outline-none placeholder:text-fg-secondary"
          onFocus={onFocus}
          onKeyDown={e => {
            if (e.key === 'Escape') onEscape();
          }}
          onChange={e => onQueryChange(e.target.value)}
        />
        {active && (
          <IconButton size="sm" label={t('common.aria.clear')} onClick={onClear}>
            <X strokeWidth={1.75} />
          </IconButton>
        )}
      </div>
    </div>
  );
};
