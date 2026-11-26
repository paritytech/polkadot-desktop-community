import { useObservable } from 'react-rx';

import { type ChatSession } from '@/domains/chat';
import { chatService } from '../../service';

import { Avatar } from './Avatar';

type Props = {
  sessions: ChatSession[];
  onSelect(session: ChatSession): void;
};

export const RecentContactsRow = ({ sessions, onSelect }: Props) => {
  if (sessions.length === 0) return null;

  return (
    <div className="flex shrink-0 gap-1 overflow-x-auto px-2 py-2">
      {sessions.map(session => (
        <RecentChip key={session.sessionId} session={session} onSelect={() => onSelect(session)} />
      ))}
    </div>
  );
};

const RecentChip = ({ session, onSelect }: { session: ChatSession; onSelect: VoidFunction }) => {
  const rawName = useObservable(session.name, '');
  const name = chatService.formatPeerName(rawName, session.roomId);

  return (
    <button
      className="flex w-16 shrink-0 flex-col items-center gap-1 rounded-lg p-1 transition-colors hover:bg-bg-selection-container-hover"
      onClick={onSelect}
    >
      <Avatar name={name} size="48" />
      <span className="w-full truncate text-center text-xs text-fg-secondary">{name}</span>
    </button>
  );
};
