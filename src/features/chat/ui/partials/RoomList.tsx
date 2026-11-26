import { MessagesSquare } from 'lucide-react';

import { EmptyState } from '@/shared/components';
import { useTranslation } from '@/shared/translation';
import { type ChatSession } from '@/domains/chat';
import { useSortedSessions } from '../../hooks/useSortedSessions';
import { type ChatItemDensity } from '../../service';

import { ChatItem } from './ChatItem';

type Props = {
  sessions: ChatSession[];
  selected: ChatSession | null;
  onSelect: (session: ChatSession) => void;
  hideEmpty?: boolean;
  // Cap the number of rendered items. Undefined renders all (QuickChat / fullscreen).
  visibleCount?: number;
  // Item density + fixed per-item height, forwarded to each ChatItem for the
  // non-scrolling dashboard widget. Defaults preserve the natural rich layout.
  density?: ChatItemDensity;
  itemHeight?: number;
};

export const RoomList = ({ sessions, selected, onSelect, hideEmpty, visibleCount, density, itemHeight }: Props) => {
  const { t } = useTranslation();
  const sortedSessions = useSortedSessions(sessions);

  if (sessions.length === 0) {
    if (hideEmpty) return null;
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon={<MessagesSquare />}
          title={t('feature.chat.noChatsYet')}
          description={t('feature.chat.yourChatsWillAppear')}
        />
      </div>
    );
  }

  const visibleSessions = visibleCount != null ? sortedSessions.slice(0, visibleCount) : sortedSessions;

  return (
    <>
      {visibleSessions.map(session => (
        <ChatItem
          key={session.sessionId}
          session={session}
          isSelected={selected?.sessionId === session.sessionId}
          density={density}
          itemHeight={itemHeight}
          onClick={() => onSelect(session)}
        />
      ))}
    </>
  );
};
