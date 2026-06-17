import { useMemo } from 'react';

import { useFitCount } from '@/shared/hooks';
import { TEST_IDS } from '@/shared/test-ids';
import { useProductSessions } from '@/domains/chat';
import { useP2PSessions } from '@/aggregates/p2p-chat';
import { useOpenProductChatRoom } from '../hooks/useOpenProductChatRoom';

import { CHAT_ITEM_HEIGHT } from './partials/ChatItem';
import { ChatItemSkeleton } from './partials/ChatItemSkeleton';
import { RoomList } from './partials/RoomList';

export const ChatWidget = () => {
  const openChatRoom = useOpenProductChatRoom();
  const { data: productSessions, pending: pendingProduct } = useProductSessions();
  const { data: p2pSessions, pending: pendingP2P } = useP2PSessions();

  const pending = pendingProduct || pendingP2P;
  const sessions = useMemo(() => [...productSessions, ...p2pSessions], [productSessions, p2pSessions]);

  const { containerRef, count } = useFitCount({
    itemHeight: CHAT_ITEM_HEIGHT,
    maxCount: sessions.length || 5,
    defaultCount: 5,
  });

  return (
    <div data-testid={TEST_IDS.chatWidget} className="flex h-full w-full flex-col">
      <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto">
        {pending ? (
          // eslint-disable-next-line react/no-array-index-key
          Array.from({ length: count }).map((_, index) => <ChatItemSkeleton key={index} isLast={index === count - 1} />)
        ) : (
          <RoomList sessions={sessions} selected={null} onSelect={session => openChatRoom(session.sessionId)} />
        )}
      </div>
    </div>
  );
};
