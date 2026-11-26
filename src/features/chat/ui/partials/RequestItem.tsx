import { X } from 'lucide-react';
import { type MouseEvent } from 'react';

import { IconButton, ListItem } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
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
    <ListItem
      icon={<Avatar name={name} size="40" />}
      label={name}
      description={<span>{preview}</span>}
      action={
        <IconButton size="sm" label={t('feature.chat.request.decline')} onClick={handleDecline}>
          <X aria-hidden />
        </IconButton>
      }
      selected={selected}
      testId={TEST_IDS.chatRequestItem}
      onClick={onSelect}
    />
  );
};
