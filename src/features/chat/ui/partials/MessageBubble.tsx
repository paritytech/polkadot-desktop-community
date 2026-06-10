import { Check, CheckCheck, Clock } from 'lucide-react';
import { type MouseEvent } from 'react';

import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type ChatMessage, type ChatMessageStatus, type ReactionAggregate } from '@/domains/chat';
import { formatMessageDate, getMessagePreview, getPlainText } from '../helpers/message';

import { AttachmentRenderer } from './AttachmentRenderer';
import { CustomMessage } from './CustomMessage';
import { ReactionPills } from './ReactionPills';

type MessageBubbleProps = {
  productId: string;
  roomId: string;
  message: ChatMessage;
  isMe: boolean;
  isLastInGroup?: boolean;
  quotedMessage?: ChatMessage | null;
  reactions?: ReactionAggregate[];
  editedText?: string;
  isEdited?: boolean;
  onContextMenu?: (e: MouseEvent<HTMLDivElement>) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onViewEditHistory?: VoidFunction;
};

export const StatusIcon = ({ status, className }: { status: ChatMessageStatus; className?: string }) => {
  if (status.direction === 'incoming') return null;
  switch (status.state) {
    case 'new':
      return <Clock className={className} />;
    case 'sent':
      return <Check className={className} />;
    case 'delivered':
      return <CheckCheck className={className} />;
  }
};

export const MessageBubble = ({
  productId,
  roomId,
  message,
  isMe,
  isLastInGroup,
  quotedMessage,
  reactions = [],
  editedText,
  isEdited,
  onContextMenu,
  onToggleReaction,
  onViewEditHistory,
}: MessageBubbleProps) => {
  const { t } = useTranslation();
  const baseRounding = isLastInGroup
    ? isMe
      ? 'rounded-tl-2xl rounded-tr-2xl rounded-br-[4px] rounded-bl-2xl'
      : 'rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-[4px]'
    : 'rounded-2xl';

  if (message.content.type === 'custom') {
    return (
      <div className="relative" onContextMenu={onContextMenu}>
        <CustomMessage
          messageId={message.messageId}
          productId={productId}
          roomId={roomId}
          messageType={message.content.messageType}
          payload={message.content.payload}
        />
        {reactions.length > 0 && (
          <div className="absolute -bottom-2.5 left-2">
            <ReactionPills reactions={reactions} onToggleReaction={emoji => onToggleReaction?.(message.messageId, emoji)} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        className={cnTw(
          'flex max-w-130 flex-col gap-2 pt-2 pb-3 pl-3',
          isMe ? 'bg-bg-surface-container-inverted pr-2 text-fg-primary-inverted' : 'bg-bg-surface-nested pr-3 text-fg-primary',
          baseRounding,
        )}
        onContextMenu={onContextMenu}
      >
        {quotedMessage && (
          <div className="flex w-full items-stretch gap-1">
            <div className={cnTw('w-1 shrink-0 self-stretch rounded-full', isMe ? 'bg-fg-primary-inverted' : 'bg-fg-primary')} />
            <div
              className={cnTw(
                'min-w-0 flex-1 rounded-xl px-3.5 pt-3 pb-2',
                isMe ? 'bg-bg-surface-nested-inverted' : 'bg-bg-surface-container',
              )}
            >
              <p className={cnTw('line-clamp-2 text-sm leading-[18px]', isMe ? 'text-fg-primary-inverted' : 'text-fg-primary')}>
                {getMessagePreview(quotedMessage)}
              </p>
            </div>
          </div>
        )}
        {message.content.type === 'richText' && message.content.attachments && message.content.attachments.length > 0 && (
          <AttachmentRenderer attachments={message.content.attachments} isMe={isMe} />
        )}
        <div className="flex w-full items-end justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center">
            <p className="max-w-130 text-base leading-5 whitespace-pre-line">{editedText ?? getPlainText(message.content)}</p>
          </div>
          <div className="flex shrink-0 items-end gap-1">
            {isEdited && (
              <button
                className={cnTw(
                  'text-right text-xs leading-4 font-medium hover:underline',
                  isMe ? 'text-fg-secondary-inverted' : 'text-fg-tertiary',
                )}
                onClick={onViewEditHistory}
              >
                {t('feature.chat.edited')}
              </button>
            )}
            <span
              className={cnTw(
                'text-right text-xs leading-4 font-medium',
                isMe ? 'text-fg-secondary-inverted' : 'text-fg-tertiary',
              )}
            >
              {formatMessageDate(message.timestamp)}
            </span>
            {isMe && (
              <div className="flex size-3 items-center justify-center">
                <StatusIcon status={message.status} className="size-3 text-fg-secondary-inverted" />
              </div>
            )}
          </div>
        </div>
      </div>
      {reactions.length > 0 && (
        <div className="absolute -bottom-2.5 left-2">
          <ReactionPills reactions={reactions} onToggleReaction={emoji => onToggleReaction?.(message.messageId, emoji)} />
        </div>
      )}
    </div>
  );
};

type ChatEventItemProps = {
  text: string;
};

export const ChatEventItem = ({ text }: ChatEventItemProps) => (
  <div className="relative flex w-full items-center justify-center py-2">
    <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border-divider" />
    <span className="relative rounded-full bg-bg-surface-main px-3 py-1 text-center text-sm leading-5 font-medium text-fg-secondary">
      {text}
    </span>
  </div>
);

type DateSeparatorProps = {
  text: string;
};

export const DateSeparator = ({ text }: DateSeparatorProps) => (
  <div className="flex w-full items-center justify-center py-2">
    <span className="text-center text-sm leading-5 font-medium text-fg-secondary">{text}</span>
  </div>
);
