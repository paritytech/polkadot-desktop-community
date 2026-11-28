import { useRef } from 'react';

import { EmptyState } from '@/shared/components';
import { MessageCircleIcon, TrashIcon } from '@/shared/icons';
import { useTranslation } from '@/shared/translation';
import { chatService } from '../../service';

import { MessageInput } from './MessageInput';
import { RequestRoomHeader } from './RequestRoomHeader';
import { RoomPane } from './RoomPane';

type DraftInvitationRoomProps = {
  name: string;
  onSend: (text: string) => Promise<void>;
  onCancel: VoidFunction;
  sendError?: string | null;
};

export const DraftInvitationRoom = ({ name, onSend, onCancel, sendError }: DraftInvitationRoomProps) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const displayName = chatService.formatPeerName(name);

  return (
    <div className="flex min-w-111 flex-1">
      <RoomPane>
        <RequestRoomHeader
          name={displayName}
          actionIcon={<TrashIcon />}
          actionLabel={t('feature.chat.leaveChat')}
          onAction={onCancel}
        />

        <EmptyState
          icon={<MessageCircleIcon />}
          title={t('feature.chat.request.inviteTitle', { name: displayName })}
          description={t('feature.chat.request.inviteHint')}
        />

        <div className="shrink-0 border-t border-stroke-primary">
          <div className="flex flex-col gap-2 p-2">
            {sendError && <p className="px-1 text-xs text-fg-error">{sendError}</p>}
            {/* The invitation send can stay in flight indefinitely (#873), so the button
              stays put and spins rather than vanishing with nothing in its place. */}
            <MessageInput ref={inputRef} showSendProgress submitAction={onSend} />
          </div>
        </div>
      </RoomPane>
    </div>
  );
};
