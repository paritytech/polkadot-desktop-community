import { File, Heart, Image as ImageIcon, Video } from 'lucide-react';
import { useMemo } from 'react';
import { useObservable } from 'react-rx';
import { map } from 'rxjs';

import { TEST_IDS } from '@/shared/test-ids';
import { cnTw } from '@/shared/utils';
import { type ChatSession } from '@/domains/chat';
import {
  type MessagePreviewAttachment,
  formatLastMessageDate,
  getMessagePreview,
  getMessagePreviewAttachment,
} from '../helpers/message';
import { formatPeerName } from '../helpers/peerName';

import { Avatar } from './Avatar';

type ChatItemProps = {
  session: ChatSession;
  isSelected?: boolean;
  isLast?: boolean;
  onClick?: () => void;
};

export const CHAT_ITEM_HEIGHT = 88;

const AttachmentIcon = ({ kind, className }: { kind: MessagePreviewAttachment; className?: string }) => {
  if (!kind) return null;
  const Icon = kind === 'image' ? ImageIcon : kind === 'video' ? Video : File;
  return <Icon className={cnTw('size-4 shrink-0', className)} />;
};

export const ChatItem = ({ session, isSelected, isLast, onClick }: ChatItemProps) => {
  const rawName = useObservable(session.name, '');
  const name = formatPeerName(rawName, session.roomId);
  const lastMessage = useObservable(session.lastMessage, null);
  const unreadCount = useObservable(session.unreadCount, 0);
  const participants = useObservable(session.participants, []);

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
  const previewText = hasLastMessage ? getMessagePreview(lastMessage) : '';
  const previewAttachment = hasLastMessage ? getMessagePreviewAttachment(lastMessage) : null;
  const hasBadges = hasUnreadReaction || unreadCount > 0;

  return (
    <div
      data-testid={TEST_IDS.chatRoomItem}
      className={cnTw(
        'relative flex h-22 w-full cursor-pointer items-start gap-3 p-3 transition-colors hover:bg-bg-selection-container-hover',
        {
          'bg-bg-selection-container-active': isSelected,
          'after:absolute after:right-3 after:bottom-0 after:left-22 after:h-px after:bg-border-divider': !isLast,
        },
      )}
      onClick={onClick}
    >
      <Avatar name={name} size="chat-list" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex w-full items-end gap-2">
          <span className="min-w-0 flex-1 truncate text-base leading-6 font-semibold text-fg-primary">{name}</span>
          {hasLastMessage && (
            <span className="shrink-0 text-sm leading-5 font-medium text-fg-tertiary">
              {formatLastMessageDate(lastMessage.timestamp)}
            </span>
          )}
        </div>
        <div className="flex w-full items-start gap-2">
          <div className="flex max-h-9 min-w-0 flex-1 flex-col items-start">
            {hasLastMessage && isGroup && (
              <span className="w-full truncate text-sm leading-[18px] text-fg-primary">{lastMessage.peer.name}</span>
            )}
            {hasLastMessage && (
              <div className="flex w-full items-center gap-1">
                <AttachmentIcon kind={previewAttachment} className="text-fg-secondary" />
                <span className="line-clamp-1 min-w-0 flex-1 text-sm leading-[18px] text-fg-secondary">{previewText}</span>
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
                  <span className="text-center text-xs leading-4 font-semibold tracking-[1px] text-fg-primary-inverted uppercase">
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
