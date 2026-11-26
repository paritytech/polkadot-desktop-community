import { useMemo } from 'react';
import { useObservable } from 'react-rx';
import { map } from 'rxjs';

import { ListItem } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { type ChatSession } from '@/domains/chat';
import { useLastMessagePreview } from '../../hooks/useLastMessagePreview';
import { type ChatItemDensity, chatService } from '../../service';

import { Avatar } from './Avatar';
import { PreviewIcon } from './PreviewIcon';
import { UnreadCount } from './UnreadCount';

type ChatItemProps = {
  session: ChatSession;
  isSelected?: boolean;
  // `compact` drops the group-sender line so the row fits a short widget slot.
  density?: ChatItemDensity;
  // Fixed row height in px for the non-scrolling widget; the row stretches to it and a shorter slot clips it.
  itemHeight?: number;
  onClick?: VoidFunction;
};

export const ChatItem = ({ session, isSelected, density = 'regular', itemHeight, onClick }: ChatItemProps) => {
  const rawName = useObservable(session.name, '');
  const name = chatService.formatPeerName(rawName, session.roomId);
  const lastMessage = useObservable(session.lastMessage, null);
  const unreadCount = useObservable(session.unreadCount, 0);
  const participants = useObservable(session.participants, []);
  const { text: previewText, icon: previewIcon } = useLastMessagePreview(session);

  const hasUnreadReaction$ = useMemo(
    () =>
      session.messages.pipe(
        map(msgs =>
          msgs.some(
            m =>
              (m.content.type === 'reacted' || m.content.type === 'reactionRemoved') &&
              m.status.direction === 'incoming' &&
              m.status.state === 'new',
          ),
        ),
      ),
    [session.messages],
  );
  const hasUnreadReaction = useObservable(hasUnreadReaction$, false);
  const isGroup = participants.length > 1;
  const isCompact = density === 'compact';
  const rowStyle = useMemo(() => ({ height: itemHeight }), [itemHeight]);

  const row = (
    <ListItem
      icon={<Avatar name={name} size="40" />}
      label={name}
      description={
        lastMessage ? (
          <>
            {isGroup && !isCompact ? <span>{lastMessage.peer.name}</span> : null}
            <span>
              <PreviewIcon kind={previewIcon} />
              {previewText}
            </span>
          </>
        ) : null
      }
      meta={
        <span className="flex flex-col items-end gap-1">
          {lastMessage ? <span>{chatService.formatChatListTime(lastMessage.timestamp)}</span> : null}
          <UnreadCount count={unreadCount} reaction={hasUnreadReaction} />
        </span>
      }
      selected={isSelected}
      testId={TEST_IDS.chatRoomItem}
      onClick={onClick}
    />
  );

  if (itemHeight == null) return row;

  return (
    <div className="flex overflow-hidden" style={rowStyle}>
      {row}
    </div>
  );
};
