import { Avatar, ListItem } from '@/shared/components';
import { TimerIcon } from '@/shared/icons';
import { TEST_IDS } from '@/shared/test-ids';
import { type P2PChatRequest } from '@/domains/chat';
import { chatService } from '../../service';

type OutgoingRequestItemProps = {
  request: P2PChatRequest;
  selected: boolean;
  onClick: VoidFunction;
};

export const OutgoingRequestItem = ({ request, selected, onClick }: OutgoingRequestItemProps) => {
  const name = request.peerUsername ?? `${request.peerId.slice(0, 12)}...`;
  const time = chatService.formatChatListTime(request.timestamp);

  return (
    <ListItem
      icon={<Avatar label={name} size="40" />}
      label={name}
      description={request.welcomeMessage ? <span>{request.welcomeMessage}</span> : null}
      meta={
        <span className="flex items-center gap-1">
          <TimerIcon className="size-3" />
          {time}
        </span>
      }
      selected={selected}
      testId={TEST_IDS.chatOutgoingRequestItem}
      onClick={onClick}
    />
  );
};
