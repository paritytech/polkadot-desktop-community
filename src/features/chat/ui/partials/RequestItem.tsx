import { X } from 'lucide-react';
import { type MouseEvent } from 'react';

import { IconButton } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type P2PChatRequest, p2pService } from '@/domains/chat';
import { chatService } from '../../service';

import { Avatar } from './Avatar';

type RequestItemProps = {
  request: P2PChatRequest;
  selected: boolean;
  hideByDefault: boolean;
  onSelect: VoidFunction;
  onDecline: VoidFunction;
};

export const RequestItem = ({ request, selected, hideByDefault, onSelect, onDecline }: RequestItemProps) => {
  const { t } = useTranslation();
  const name = chatService.formatPeerName(request.peerUsername, request.peerId);
  const isHidden = p2pService.isRequestMessageHidden(request, hideByDefault);
  const preview = isHidden || !request.welcomeMessage ? t('feature.chat.request.messageHidden') : request.welcomeMessage;

  const handleDecline = (e: MouseEvent) => {
    e.stopPropagation();
    onDecline();
  };

  return (
    <div
      data-testid={TEST_IDS.chatRequestItem}
      className={cnTw(
        'relative flex w-full cursor-pointer items-center gap-3 p-3 transition-colors after:absolute after:start-22 after:end-3 after:bottom-0 after:h-px after:bg-stroke-secondary',
        selected ? 'bg-bg-selection-container-active' : 'hover:bg-bg-selection-container-hover',
      )}
      onClick={onSelect}
    >
      <Avatar name={name} size="40" />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <span className="min-w-0 truncate text-base font-semibold text-fg-primary">{name}</span>
        <span className="min-w-0 truncate text-sm text-fg-secondary">{preview}</span>
      </div>
      <IconButton size="sm" label={t('feature.chat.request.decline')} onClick={handleDecline}>
        <X aria-hidden />
      </IconButton>
    </div>
  );
};
