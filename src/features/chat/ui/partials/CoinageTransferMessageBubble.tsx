import { type FC, type MouseEvent, type SVGProps } from 'react';

import ArrowDownIcon from '@/shared/assets/images/icons/arrow-down.svg?jsx';
import ArrowUpIcon from '@/shared/assets/images/icons/arrow-up.svg?jsx';
import CheckCheckIcon from '@/shared/assets/images/icons/check-check.svg?jsx';
import CheckIcon from '@/shared/assets/images/icons/check.svg?jsx';
import { useTranslation } from '@/shared/translation';
import { amountToString, cnTw } from '@/shared/utils';
import { environmentUseCase } from '@/domains/application';
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

type CoinageStatus = NonNullable<TransferContent['coinageStatus']>;

type StatusRow = {
  Icon: FC<SVGProps<SVGSVGElement>>;
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
  submitting: { Icon: ArrowUpIcon, labelKey: 'feature.chat.transfer.coinage.submitting' },
  sending: { Icon: ArrowUpIcon, labelKey: 'feature.chat.transfer.coinage.sending' },
  sent: { Icon: CheckIcon, labelKey: 'feature.chat.transfer.coinage.sent' },
  delivered: { Icon: CheckCheckIcon, labelKey: 'feature.chat.transfer.coinage.delivered' },
  claimed: { Icon: CheckCheckIcon, labelKey: 'feature.chat.transfer.coinage.claimed', isClaimed: true },
};

export const CoinageTransferMessageBubble = ({ message, content, isMe, isSeen = false, onContextMenu }: Props) => {
  const { t } = useTranslation();

  // `content.amount` is plancks of the active channel's digital-dollar; precision
  // tracks Android's `DigitalDollarChainAssetProvider` so the same amount renders
  // identically on both ends. It's synchronous `VITE_ENVIRONMENTS` config (not
  // Remote Config), so it's available on the first render — no blank-amount flicker.
  const asset = environmentUseCase.getActiveDigitalDollarAsset();
  const formattedAmount = amountToString(content.amount, asset.precision);
  const headerLabel = isMe ? t('feature.chat.transfer.youSent') : t('feature.chat.transfer.received');

  // Incoming Coinage bubbles render without the status row — recipient sees a
  // standard "Received $X" card. The lifecycle is meaningful only on the
  // sender side.
  const status = isMe ? (content.coinageStatus ?? 'sent') : null;
  const DirectionIcon = isMe ? ArrowUpIcon : ArrowDownIcon;
  const fallbackLabel = isMe ? t('feature.chat.transfer.sent') : t('feature.chat.transfer.received');

  const statusRow = status ? STATUS_ROWS[status] : null;
  const StatusRowIcon = statusRow?.Icon ?? DirectionIcon;
  const statusLabel = statusRow ? t(statusRow.labelKey) : fallbackLabel;

  return (
    <div
      className={cnTw(
        'flex w-62.5 flex-col items-start gap-2 ps-3 pe-2 pt-3 pb-2',
        'rounded-ss-2xl rounded-se-2xl',
        isMe
          ? 'rounded-ee-sm rounded-es-2xl bg-bg-surface-container-inverted'
          : 'rounded-ee-2xl rounded-es-sm bg-bg-surface-nested',
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
          <p
            className={cnTw(
              'text-sm font-medium tracking-wide whitespace-nowrap',
              isMe ? 'text-fg-secondary-inverted' : 'text-fg-secondary',
            )}
          >
            {asset.symbol}
          </p>
        </div>
      </div>
      <div className="flex w-full items-center gap-1">
        <StatusRowIcon
          className={cnTw(
            'size-3 shrink-0',
            statusRow?.isClaimed ? 'text-fg-success' : isMe ? 'text-fg-secondary-inverted' : 'text-fg-secondary',
          )}
        />
        <p
          className={cnTw(
            'text-sm whitespace-nowrap',
            statusRow?.isClaimed ? 'text-fg-success' : isMe ? 'text-fg-secondary-inverted' : 'text-fg-secondary',
          )}
        >
          {statusLabel}
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
