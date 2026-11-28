import { type MouseEvent } from 'react';

import { ArrowDownIcon, ArrowUpIcon } from '@/shared/icons';
import { useTranslation } from '@/shared/translation';
import { amountToString, cnTw } from '@/shared/utils';
import { type ChatMessage, type TransferContent } from '@/domains/chat';
import { chatService } from '../../service';

import { StatusIcon } from './MessageBubble';

type Props = {
  message: ChatMessage;
  content: TransferContent;
  isMe: boolean;
  isSeen?: boolean;
  onContextMenu?: (e: MouseEvent<HTMLDivElement>) => void;
};

// Coinage payments are always native; chain configs currently ship empty
// `assets[]` so we cannot resolve the native symbol from the network domain.
// 10 = Polkadot/Paseo standard, matches the active environment.
const NATIVE_PRECISION = 10;

export const TransferMessageBubble = ({ message, content, isMe, isSeen = false, onContextMenu }: Props) => {
  const { t } = useTranslation();

  const formattedAmount = amountToString(content.amount, NATIVE_PRECISION);
  const headerLabel = isMe ? t('feature.chat.transfer.youSent') : t('feature.chat.transfer.received');
  const DirectionIcon = isMe ? ArrowUpIcon : ArrowDownIcon;
  const directionLabel = isMe ? t('feature.chat.transfer.sent') : t('feature.chat.transfer.received');

  return (
    <div
      className={cnTw(
        'flex flex-col items-start gap-2 ps-3 pe-2 pt-3 pb-2',
        isMe
          ? 'rounded-ss-2xl rounded-se-2xl rounded-ee-sm rounded-es-2xl bg-bg-surface-container-inverted'
          : 'rounded-ss-2xl rounded-se-2xl rounded-ee-2xl rounded-es-sm bg-bg-surface-nested',
      )}
      onContextMenu={onContextMenu}
    >
      <div className="flex w-full flex-col items-start gap-2 pe-1">
        <p className={cnTw('w-full text-sm', isMe ? 'text-fg-secondary-inverted' : 'text-fg-secondary')}>{headerLabel}</p>
        <div
          className={cnTw(
            'flex w-full flex-col items-center justify-center rounded-xl p-4',
            isMe ? 'bg-bg-surface-nested-inverted' : 'bg-bg-surface-container',
          )}
        >
          <p className={cnTw('text-3xl font-semibold whitespace-nowrap', isMe ? 'text-fg-primary-inverted' : 'text-fg-primary')}>
            {formattedAmount}
          </p>
        </div>
      </div>
      <div className="flex w-full items-center gap-1">
        <DirectionIcon className={cnTw('size-3 shrink-0', isMe ? 'text-fg-secondary-inverted' : 'text-fg-secondary')} />
        <p className={cnTw('text-sm whitespace-nowrap', isMe ? 'text-fg-secondary-inverted' : 'text-fg-secondary')}>
          {directionLabel}
        </p>
      </div>
      <div className="flex w-full items-center justify-end gap-0.5">
        <span className={cnTw('text-xs whitespace-nowrap', isMe ? 'text-fg-secondary-inverted' : 'text-fg-tertiary')}>
          {chatService.formatMessageDate(message.timestamp)}
        </span>
        {isMe && (
          <div className="flex size-3 items-center justify-center">
            <StatusIcon status={message.status} isSeen={isSeen} className="size-3 text-fg-secondary-inverted" />
          </div>
        )}
      </div>
    </div>
  );
};
