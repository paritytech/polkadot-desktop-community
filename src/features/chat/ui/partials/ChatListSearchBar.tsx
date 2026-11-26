import { Search, X } from 'lucide-react';
import { type Ref } from 'react';

import { IconButton, Input } from '@/shared/components';
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
      <Input
        ref={inputRef}
        leading={<Search />}
        type="text"
        data-testid={TEST_IDS.contactSearchInput}
        value={query}
        placeholder={t('feature.chat.searchByUsernameOrMessages')}
        aria-label={t('feature.chat.searchByUsernameOrMessages')}
        trailing={
          active && (
            <IconButton size="sm" label={t('common.aria.clear')} onClick={onClear}>
              <X strokeWidth={1.75} />
            </IconButton>
          )
        }
        onFocus={onFocus}
        onKeyDown={e => {
          if (e.key === 'Escape') onEscape();
        }}
        onChange={e => onQueryChange(e.target.value)}
      />
    </div>
  );
};
