import { Trash2 } from 'lucide-react';
import { useRef } from 'react';

import { useTranslation } from '@/shared/translation';
import { chatService } from '../../service';

import { MessageInput } from './MessageInput';
import { RequestRoomHeader } from './RequestRoomHeader';

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
    <div className="flex min-w-111 flex-1 flex-col overflow-hidden rounded-xl border border-stroke-primary bg-bg-surface-container">
      <RequestRoomHeader
        name={displayName}
        actionIcon={<Trash2 className="size-4" />}
        actionLabel={t('feature.chat.leaveChat')}
        onAction={onCancel}
      />

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-4 text-center">
        <p className="text-base font-semibold text-fg-primary">{t('feature.chat.request.inviteTitle', { name: displayName })}</p>
        <p className="mt-1 text-sm text-fg-secondary">{t('feature.chat.request.inviteHint')}</p>
      </div>

      <div className="shrink-0 border-t border-stroke-primary">
        <div className="flex flex-col gap-2 p-2">
          {sendError && <p className="px-1 text-xs text-fg-error">{sendError}</p>}
          {/* The invitation send can stay in flight indefinitely (#873), so the button
              stays put and spins rather than vanishing with nothing in its place. */}
          <MessageInput ref={inputRef} showSendProgress submitAction={onSend} />
        </div>
      </div>
    </div>
  );
};
