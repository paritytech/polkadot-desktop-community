import { Timer } from 'lucide-react';

import { ListItem } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { type P2PChatRequest } from '@/domains/chat';
import { chatService } from '../../service';

import { Avatar } from './Avatar';

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
      icon={<Avatar name={name} size="40" />}
      label={name}
      description={<span>{request.welcomeMessage ?? ''}</span>}
      meta={
        <span className="flex items-center gap-1">
          <Timer aria-hidden className="size-3" />
          {time}
        </span>
      }
      selected={selected}
      testId={TEST_IDS.chatOutgoingRequestItem}
      onClick={onClick}
    />
  );
};
