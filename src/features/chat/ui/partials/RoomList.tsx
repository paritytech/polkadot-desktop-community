import { MessagesSquare } from 'lucide-react';
import { useMemo } from 'react';
import { useObservable } from 'react-rx';
import { combineLatest, map, of } from 'rxjs';

import { useTranslation } from '@/shared/translation';
import { type ChatSession } from '@/domains/chat';

import { ChatItem } from './ChatItem';
import { NoData } from './NoData';

const useSortedSessions = (sessions: ChatSession[]): ChatSession[] => {
  const sorted$ = useMemo(() => {
    if (sessions.length === 0) return of([]);

    return combineLatest(
      sessions.map(s => s.lastMessage.pipe(map(msg => ({ session: s, timestamp: msg?.timestamp ?? 0 })))),
    ).pipe(map(items => [...items].sort((a, b) => b.timestamp - a.timestamp).map(i => i.session)));
  }, [sessions]);

  return useObservable(sorted$, sessions);
};

type Props = {
  sessions: ChatSession[];
  selected: ChatSession | null;
  onSelect: (session: ChatSession) => void;
  hideEmpty?: boolean;
};

export const RoomList = ({ sessions, selected, onSelect, hideEmpty }: Props) => {
  const { t } = useTranslation();
  const sortedSessions = useSortedSessions(sessions);

  if (sessions.length === 0) {
    if (hideEmpty) return null;
    return (
      <div className="flex h-full items-center justify-center">
        <NoData icon={MessagesSquare} title={t('feature.chat.noChatsYet')} description={t('feature.chat.yourChatsWillAppear')} />
      </div>
    );
  }

  return (
    <>
      {sortedSessions.map((session, index) => (
        <ChatItem
          key={session.sessionId}
          session={session}
          isLast={index === sortedSessions.length - 1}
          isSelected={selected?.sessionId === session.sessionId}
          onClick={() => onSelect(session)}
        />
      ))}
    </>
  );
};
