import XIcon from '@/shared/assets/images/icons/x.svg?jsx';
import { Avatar, IconButton, ListItem } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { type P2PChatRequest, p2pService } from '@/domains/chat';
import { chatService } from '../../service';

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

  return (
    <ListItem
      icon={<Avatar label={name} size="40" />}
      label={name}
      description={<span>{preview}</span>}
      action={
        <IconButton size="sm" label={t('feature.chat.request.decline')} onClick={onDecline}>
          <XIcon />
        </IconButton>
      }
      selected={selected}
      testId={TEST_IDS.chatRequestItem}
      onClick={onSelect}
    />
  );
};
