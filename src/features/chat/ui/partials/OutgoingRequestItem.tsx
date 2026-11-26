import { Timer } from 'lucide-react';

import { cnTw } from '@/shared/utils';
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
    <div
      className={cnTw(
        'relative flex h-22 w-full cursor-pointer items-start gap-3 p-3 transition-colors after:absolute after:start-22 after:end-3 after:bottom-0 after:h-px after:bg-stroke-secondary',
        selected ? 'bg-bg-selection-container-active' : 'hover:bg-bg-selection-container-hover',
      )}
      onClick={onClick}
    >
      <Avatar name={name} size="40" />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <div className="flex w-full items-end gap-2">
          <span className="max-w-full min-w-0 truncate text-base font-semibold text-fg-primary">{name}</span>
          <Timer className="size-4 shrink-0 text-fg-tertiary" />
          <span className="ms-auto shrink-0 text-sm font-medium text-fg-tertiary">{time}</span>
        </div>
        <span className="min-w-0 truncate text-sm text-fg-secondary">{request.welcomeMessage ?? ''}</span>
      </div>
    </div>
  );
};
