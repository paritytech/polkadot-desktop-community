import { ArrowDown, ArrowUp, Check, CheckCheck } from 'lucide-react';
import { type ComponentType, type MouseEvent } from 'react';

import { useTranslation } from '@/shared/translation';
import { amountToString, cnTw } from '@/shared/utils';
import { environmentService } from '@/domains/application';
import { type ChatMessage, type TransferContent } from '@/domains/chat';
import { formatMessageDate } from '../helpers/message';

import { StatusIcon } from './MessageBubble';

type Props = {
  message: ChatMessage;
  content: TransferContent;
  isMe: boolean;
  onContextMenu?: (e: MouseEvent<HTMLDivElement>) => void;
};

type CoinageStatus = NonNullable<TransferContent['coinageStatus']>;

type StatusRow = {
  Icon: ComponentType<{ className?: string }>;
  labelKey: string;
  isClaimed?: boolean;
};

// Maps coinage delivery lifecycle to the status row at the bottom of the
// bubble. Figma reference: Pocket file, node 401:5457 (Funds Send · Sent · Chat).
// - submitting / sending: up-arrow (same as a fresh outgoing transfer).
// - sent: single check (Substrate inBlock — extrinsic landed but recipient hasn't pulled).
// - delivered: double check (claim memo arrived on recipient device, not yet read).
// - claimed: double check, green tint (recipient imported the coin keys).
const STATUS_ROWS: Record<CoinageStatus, StatusRow> = {
  submitting: { Icon: ArrowUp, labelKey: 'feature.chat.transfer.coinage.submitting' },
  sending: { Icon: ArrowUp, labelKey: 'feature.chat.transfer.coinage.sending' },
  sent: { Icon: Check, labelKey: 'feature.chat.transfer.coinage.sent' },
  delivered: { Icon: CheckCheck, labelKey: 'feature.chat.transfer.coinage.delivered' },
  claimed: { Icon: CheckCheck, labelKey: 'feature.chat.transfer.coinage.claimed', isClaimed: true },
};

export const CoinageTransferMessageBubble = ({ message, content, isMe, onContextMenu }: Props) => {
  const { t } = useTranslation();

  // `content.amount` is plancks of the active channel's digital-dollar; precision
  // tracks Android's `DigitalDollarChainAssetProvider` so the same amount renders
  // identically on both ends. It's synchronous `VITE_ENVIRONMENTS` config (not
  // Remote Config), so it's available on the first render — no blank-amount flicker.
  const precision = environmentService.getActiveDigitalDollarAsset().precision;
  const formattedAmount = amountToString(content.amount, precision);
  const headerLabel = isMe ? t('feature.chat.transfer.youSent') : t('feature.chat.transfer.received');

  // Incoming Coinage bubbles render without the status row — recipient sees a
  // standard "Received $X" card. The lifecycle is meaningful only on the
  // sender side.
  const status = isMe ? (content.coinageStatus ?? 'sent') : null;
  const DirectionIcon = isMe ? ArrowUp : ArrowDown;
  const fallbackLabel = isMe ? t('feature.chat.transfer.sent') : t('feature.chat.transfer.received');

  const statusRow = status ? STATUS_ROWS[status] : null;
  const StatusRowIcon = statusRow?.Icon ?? DirectionIcon;
  const statusLabel = statusRow ? t(statusRow.labelKey) : fallbackLabel;

  return (
    <div
      className={cnTw(
        'flex w-[250px] flex-col items-start gap-2 pt-3 pr-2 pb-2 pl-3.5',
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
          <p
            className={cnTw(
              'text-sm leading-5 font-medium tracking-wide whitespace-nowrap',
              isMe ? 'text-fg-secondary-inverted' : 'text-fg-secondary',
            )}
          >
            {t('feature.chat.transfer.coinage.currencyLabel')}
          </p>
        </div>
      </div>
      <div className="flex w-full items-center gap-1">
        <StatusRowIcon
          className={cnTw(
            'size-3.5 shrink-0',
            statusRow?.isClaimed ? 'text-fg-success' : isMe ? 'text-fg-secondary-inverted' : 'text-fg-secondary',
          )}
        />
        <p
          className={cnTw(
            'text-sm leading-5 whitespace-nowrap',
            statusRow?.isClaimed ? 'text-fg-success' : isMe ? 'text-fg-secondary-inverted' : 'text-fg-secondary',
          )}
        >
          {statusLabel}
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
