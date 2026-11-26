import { X } from 'lucide-react';
import { useObservable } from 'react-rx';

import { Button, IconButton } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { type ChatSession } from '@/domains/chat';

import { Avatar } from './Avatar';

type Props = {
  sessions: ChatSession[];
  onSelect(session: ChatSession): void;
  onRemove(sessionId: string): void;
  onClear(): void;
};

const AvatarChip = ({ session, onSelect }: { session: ChatSession; onSelect(): void }) => {
  const name = useObservable(session.name, '');

  return (
    <button className="flex w-14 shrink-0 flex-col items-center gap-1" onClick={onSelect}>
      <Avatar name={name} size="chat-header" />
      <span className="w-full truncate text-center text-xs text-fg-secondary">{name}</span>
    </button>
  );
};

const RecentRow = ({ session, onSelect, onRemove }: { session: ChatSession; onSelect(): void; onRemove(): void }) => {
  const { t } = useTranslation();
  const name = useObservable(session.name, '');

  return (
    <div
      data-testid={TEST_IDS.contactSearchRecentItem}
      className="group relative flex w-full cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-bg-selection-container-hover"
      onClick={onSelect}
    >
      <Avatar name={name} size="chat-list" />
      <span className="min-w-0 flex-1 truncate text-base font-semibold text-fg-primary">{name}</span>
      <span className="hidden shrink-0 group-hover:flex focus-within:flex">
        <IconButton
          size="sm"
          label={t('feature.chat.removeRecentSearch')}
          onClick={e => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X />
        </IconButton>
      </span>
    </div>
  );
};

export const SearchRecentSection = ({ sessions, onSelect, onRemove, onClear }: Props) => {
  const { t } = useTranslation();
  if (sessions.length === 0) return null;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex gap-3 overflow-x-auto px-3 py-2">
        {sessions.map(session => (
          <AvatarChip key={session.sessionId} session={session} onSelect={() => onSelect(session)} />
        ))}
      </div>
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-sm font-medium text-fg-secondary">{t('feature.chat.contactSearch.recent')}</span>
        <Button variant="ghost" size="sm" data-testid={TEST_IDS.contactSearchClearRecent} onClick={onClear}>
          {t('feature.chat.contactSearch.clear')}
        </Button>
      </div>
      {sessions.map(session => (
        <RecentRow
          key={session.sessionId}
          session={session}
          onSelect={() => onSelect(session)}
          onRemove={() => onRemove(session.sessionId)}
        />
      ))}
    </div>
  );
};
