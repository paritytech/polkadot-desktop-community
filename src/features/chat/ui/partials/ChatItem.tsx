import { Heart } from 'lucide-react';
import { useMemo } from 'react';
import { useObservable } from 'react-rx';
import { map } from 'rxjs';

import { TEST_IDS } from '@/shared/test-ids';
import { cnTw } from '@/shared/utils';
import { type ChatSession } from '@/domains/chat';
import { useLastMessagePreview } from '../../hooks/useLastMessagePreview';
import { type ChatItemDensity, chatService } from '../../service';

import { Avatar } from './Avatar';
import { PreviewIcon } from './PreviewIcon';

type ChatItemProps = {
  session: ChatSession;
  isSelected?: boolean;
  isLast?: boolean;
  // Visual density. `compact` shrinks the avatar and drops the group-sender line
  // so the item fits a short widget slot. Defaults to the rich `regular` layout.
  density?: ChatItemDensity;
  // Fixed row height in px for the non-scrolling widget. When omitted the item
  // keeps its natural 88px height (used by QuickChat / fullscreen).
  itemHeight?: number;
  onClick?: () => void;
};

export const ChatItem = ({ session, isSelected, isLast, density = 'regular', itemHeight, onClick }: ChatItemProps) => {
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
  const hasLastMessage = lastMessage !== null;
  const isGroup = participants.length > 1;
  const hasBadges = hasUnreadReaction || unreadCount > 0;
  const isCompact = density === 'compact';
  const rowStyle = useMemo(() => (itemHeight != null ? { height: itemHeight } : undefined), [itemHeight]);

  return (
    <div
      data-testid={TEST_IDS.chatRoomItem}
      style={rowStyle}
      className={cnTw(
        'relative flex w-full cursor-pointer transition-colors hover:bg-bg-selection-container-hover',
        // Fixed-height widget slots center their content so the avatar keeps even
        // breathing room from the top and bottom edges; the natural-height list
        // (QuickChat / fullscreen) stays top-aligned.
        itemHeight == null ? 'h-22 items-start' : 'items-center',
        isCompact ? 'gap-2 p-2' : 'gap-3 p-3',
        {
          'bg-bg-selection-container-active': isSelected,
          'after:absolute after:bottom-0 after:h-px after:bg-stroke-secondary': !isLast,
          'after:start-22 after:end-3': !isLast && !isCompact,
          'after:start-16 after:end-2': !isLast && isCompact,
        },
      )}
      onClick={onClick}
    >
      <Avatar name={name} size={isCompact ? 'chat-list-compact' : 'chat-list'} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex w-full items-end gap-2">
          <span className="min-w-0 flex-1 truncate text-base font-semibold text-fg-primary">{name}</span>
          {hasLastMessage && (
            <span className="shrink-0 text-sm font-medium text-fg-tertiary">
              {chatService.formatChatListTime(lastMessage.timestamp)}
            </span>
          )}
        </div>
        <div className="flex w-full items-start gap-2">
          <div className={cnTw('flex min-w-0 flex-1 flex-col items-start', !isCompact && 'max-h-9')}>
            {hasLastMessage && isGroup && !isCompact && (
              <span className="w-full truncate text-sm text-fg-primary">{lastMessage.peer.name}</span>
            )}
            {hasLastMessage && (
              <div className="flex w-full items-center gap-1">
                <PreviewIcon kind={previewIcon} className="text-fg-secondary" />
                <span className="line-clamp-1 min-w-0 flex-1 text-sm text-fg-secondary">{previewText}</span>
              </div>
            )}
          </div>
          {hasBadges && (
            <div className="flex shrink-0 items-center gap-2 pt-1">
              {hasUnreadReaction && (
                <div className="flex size-5 items-center justify-center rounded-full bg-bg-illustration-dark">
                  <Heart className="size-3 fill-current text-fg-primary-inverted" />
                </div>
              )}
              {unreadCount > 0 && (
                <div className="flex h-5 min-w-5 items-center justify-center rounded-full bg-bg-illustration-dark px-1">
                  <span className="text-center text-xs font-semibold tracking-[1px] text-fg-primary-inverted uppercase">
                    {unreadCount}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
