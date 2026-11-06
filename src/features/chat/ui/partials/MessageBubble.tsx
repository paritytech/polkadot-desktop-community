import { Check, CheckCheck, Clock } from 'lucide-react';
import { type MouseEvent } from 'react';

import { BlurhashCanvas } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type ChatMessage, type ChatMessageStatus, type ReactionAggregate } from '@/domains/chat';
import { chatService } from '../../service';
import { getMessagePreview, getPlainText } from '../helpers/message';

import { AttachmentRenderer } from './AttachmentRenderer';
import { CustomMessage } from './CustomMessage';
import { MessageText } from './MessageText';
import { ReactionPills } from './ReactionPills';

type MessageBubbleProps = {
  productId: string;
  roomId: string;
  message: ChatMessage;
  isMe: boolean;
  isLastInGroup?: boolean;
  quotedMessage?: ChatMessage | null;
  quotedSenderName?: string;
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
  quotedSenderName,
  reactions = [],
  editedText,
  isEdited,
  onContextMenu,
  onToggleReaction,
  onViewEditHistory,
}: MessageBubbleProps) => {
  const { t } = useTranslation();
  const baseRounding = cnTw(
    isLastInGroup
      ? isMe
        ? 'rounded-ss-2xl rounded-se-2xl rounded-ee-sm rounded-es-2xl'
        : 'rounded-ss-2xl rounded-se-2xl rounded-ee-2xl rounded-es-[4px]'
      : 'rounded-2xl',
  );

  const quotedAttachment = quotedMessage?.content.type === 'richText' ? quotedMessage.content.attachments?.[0] : undefined;
  // string → media thumbnail (blurhash, possibly empty); null → no media, no thumbnail box.
  const quotedBlurhash =
    quotedAttachment?.meta.type === 'image' || quotedAttachment?.meta.type === 'video'
      ? (quotedAttachment.meta.blurhash ?? '')
      : null;

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
          <div className="absolute start-3 -bottom-6">
            <ReactionPills
              reactions={reactions}
              isMe={isMe}
              onToggleReaction={emoji => onToggleReaction?.(message.messageId, emoji)}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        data-testid={TEST_IDS.chatMessageBubble}
        data-direction={isMe ? 'outgoing' : 'incoming'}
        className={cnTw(
          'flex max-w-130 flex-col',
          // A reply wraps the full-width quoted card with a tight 4px frame; the body
          // text row below re-adds its own inset so the text still aligns at 12px.
          quotedMessage ? 'gap-1 p-1' : 'gap-2 ps-3 pt-2 pb-3',
          isMe
            ? cnTw('bg-bg-surface-container-inverted text-fg-primary-inverted', !quotedMessage && 'pe-2')
            : cnTw('bg-bg-surface-nested text-fg-primary', !quotedMessage && 'pe-3'),
          baseRounding,
        )}
        onContextMenu={onContextMenu}
      >
        {quotedMessage ? (
          <div
            className={cnTw(
              'flex w-full items-stretch gap-2 overflow-hidden rounded-xl border-s-4 px-3 py-2',
              isMe ? 'border-fg-secondary-inverted bg-bg-surface-nested-inverted' : 'border-fg-tertiary bg-bg-surface-container',
            )}
          >
            {quotedBlurhash !== null ? (
              <div className="aspect-square shrink-0 self-stretch overflow-hidden rounded-md border border-stroke-primary">
                <BlurhashCanvas hash={quotedBlurhash} className="size-full object-cover" />
              </div>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              {quotedSenderName ? (
                <p
                  className={cnTw(
                    'truncate text-xs leading-4 font-semibold',
                    isMe ? 'text-fg-primary-inverted' : 'text-fg-primary',
                  )}
                >
                  {quotedSenderName}
                </p>
              ) : null}
              <p
                className={cnTw(
                  'line-clamp-2 text-xs leading-4 font-medium',
                  isMe ? 'text-fg-primary-inverted' : 'text-fg-primary',
                )}
              >
                {getMessagePreview(quotedMessage)}
              </p>
            </div>
          </div>
        ) : null}
        {message.content.type === 'richText' && message.content.attachments && message.content.attachments.length > 0 && (
          <AttachmentRenderer attachments={message.content.attachments} isMe={isMe} />
        )}
        <div className={cnTw('flex w-full items-end justify-between gap-2', quotedMessage && 'ps-2 pe-1')}>
          <div className="flex min-w-0 flex-1 items-center">
            <p className="max-w-130 text-base leading-5 whitespace-pre-line" style={{ wordBreak: 'break-word' }}>
              <MessageText text={editedText ?? getPlainText(message.content)} />
            </p>
          </div>
          <div className="flex shrink-0 items-end gap-1">
            {isEdited && (
              <button
                className={cnTw(
                  'text-end text-xs leading-4 font-medium hover:underline',
                  isMe ? 'text-fg-secondary-inverted' : 'text-fg-tertiary',
                )}
                onClick={onViewEditHistory}
              >
                {t('feature.chat.edited')}
              </button>
            )}
            <span
              className={cnTw('text-end text-xs leading-4 font-medium', isMe ? 'text-fg-secondary-inverted' : 'text-fg-tertiary')}
            >
              {chatService.formatMessageDate(message.timestamp)}
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
        <div className="absolute start-3 -bottom-6">
          <ReactionPills
            reactions={reactions}
            isMe={isMe}
            onToggleReaction={emoji => onToggleReaction?.(message.messageId, emoji)}
          />
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
    <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-stroke-secondary" />
    <span className="relative rounded-full bg-bg-surface-main px-3 py-1 text-center text-sm leading-5 font-medium text-fg-secondary">
      {text}
    </span>
  </div>
);

type DateSeparatorProps = {
  text: string;
};

export const DateSeparator = ({ text }: DateSeparatorProps) => (
  <div data-testid={TEST_IDS.chatDateSeparator} className="flex w-full items-center justify-center py-2">
    <span className="text-center text-sm leading-5 font-medium text-fg-secondary">{text}</span>
  </div>
);
