import { ArrowDown, ArrowUp } from 'lucide-react';
import { type MouseEvent } from 'react';

import { useTranslation } from '@/shared/translation';
import { amountToString, cnTw } from '@/shared/utils';
import { type ChatMessage, type TransferContent } from '@/domains/chat';
import { formatMessageDate } from '../helpers/message';

import { StatusIcon } from './MessageBubble';

type Props = {
  message: ChatMessage;
  content: TransferContent;
  isMe: boolean;
  onContextMenu?: (e: MouseEvent<HTMLDivElement>) => void;
};

// Coinage payments are always native; chain configs currently ship empty
// `assets[]` so we cannot resolve the native symbol from the network domain.
// 10 = Polkadot/Paseo standard, matches the active environment.
const NATIVE_PRECISION = 10;

export const TransferMessageBubble = ({ message, content, isMe, onContextMenu }: Props) => {
  const { t } = useTranslation();

  const formattedAmount = amountToString(content.amount, NATIVE_PRECISION);
  const headerLabel = isMe ? t('feature.chat.transfer.youSent') : t('feature.chat.transfer.received');
  const DirectionIcon = isMe ? ArrowUp : ArrowDown;
  const directionLabel = isMe ? t('feature.chat.transfer.sent') : t('feature.chat.transfer.received');

  return (
    <div
      className={cnTw(
        'flex flex-col items-start gap-2 pt-3 pr-2 pb-2 pl-3.5',
        isMe
          ? 'rounded-tl-[14px] rounded-tr-[14px] rounded-br-[4px] rounded-bl-[14px] bg-bg-surface-container-inverted'
          : 'rounded-tl-[14px] rounded-tr-[14px] rounded-br-[14px] rounded-bl-[4px] bg-bg-surface-nested',
      )}
      onContextMenu={onContextMenu}
    >
      <div className="flex w-full flex-col items-start gap-2 pr-1">
        <p className={cnTw('w-full text-sm leading-5', isMe ? 'text-fg-secondary-inverted' : 'text-fg-secondary')}>
          {headerLabel}
        </p>
        <div
          className={cnTw(
            'flex w-full flex-col items-center justify-center rounded-xl p-4',
            isMe ? 'bg-bg-surface-nested-inverted' : 'bg-bg-surface-container',
          )}
        >
          <p
            className={cnTw(
              'text-[32px] leading-[38px] font-semibold whitespace-nowrap',
              isMe ? 'text-fg-primary-inverted' : 'text-fg-primary',
            )}
          >
            {formattedAmount}
          </p>
        </div>
      </div>
      <div className="flex w-full items-center gap-1">
        <DirectionIcon className={cnTw('size-3.5 shrink-0', isMe ? 'text-fg-secondary-inverted' : 'text-fg-secondary')} />
        <p className={cnTw('text-sm leading-5 whitespace-nowrap', isMe ? 'text-fg-secondary-inverted' : 'text-fg-secondary')}>
          {directionLabel}
        </p>
      </div>
      <div className="flex w-full items-center justify-end gap-0.5">
        <span
          className={cnTw('text-xs leading-[18px] whitespace-nowrap', isMe ? 'text-fg-secondary-inverted' : 'text-fg-tertiary')}
        >
          {formatMessageDate(message.timestamp)}
        </span>
        {isMe && (
          <div className="flex size-3.5 items-center justify-center">
            <StatusIcon status={message.status} className="size-3.5 text-fg-secondary-inverted" />
          </div>
        )}
      </div>
    </div>
  );
};
