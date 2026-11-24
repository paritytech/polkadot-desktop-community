import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { FormattedMessage } from 'react-intl';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { type P2PChatRequest } from '@/domains/chat';
import { chatService } from '../../service';

import { DateSeparator } from './MessageBubble';
import { RequestConfirmDialog } from './RequestConfirmDialog';
import { RequestRoomHeader } from './RequestRoomHeader';
import { RequestRoomNotice, boldName } from './RequestRoomNotice';

type Props = {
  request: P2PChatRequest;
  onCancel: (request: P2PChatRequest) => Promise<void>;
};

export const OutgoingPendingRoom = ({ request, onCancel }: Props) => {
  const { t } = useTranslation();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const name = chatService.formatPeerName(request.peerUsername, request.peerId);
  const sentAt = new Date(request.timestamp);
  const dayLabel =
    sentAt.toDateString() === new Date().toDateString()
      ? t('feature.chat.request.today')
      : sentAt.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

  const handleConfirm = async () => {
    setConfirmingCancel(false);
    await onCancel(request);
  };

  return (
    <div className="flex min-w-111 flex-1 flex-col overflow-hidden rounded-xl border border-stroke-primary bg-bg-surface-container">
      <RequestRoomHeader
        name={name}
        actionIcon={<Trash2 className="me-2 size-4" />}
        actionLabel={t('feature.chat.request.cancelRequest')}
        onAction={() => setConfirmingCancel(true)}
      />

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-4">
        <DateSeparator text={dayLabel} />
        <div className="flex w-full items-center justify-center py-2">
          <span className="text-center text-sm leading-5 font-medium text-fg-secondary">
            <FormattedMessage id="feature.chat.request.youSent" values={{ b: boldName }} />
          </span>
        </div>
        {request.welcomeMessage && (
          <div className="flex w-full flex-col items-end">
            <div className="max-w-130 rounded-2xl bg-bg-surface-container-inverted px-3 pt-2 pb-3">
              <p className="text-base leading-5 text-fg-primary-inverted">{request.welcomeMessage}</p>
            </div>
          </div>
        )}
      </div>

      <RequestRoomNotice textId="feature.chat.request.waitForAccept" name={name} />

      <RequestConfirmDialog
        isOpen={confirmingCancel}
        title={t('feature.chat.request.cancelTitle')}
        description={t('feature.chat.request.cancelBody', { name })}
        cancelLabel={t('feature.chat.request.keepRequest')}
        confirmLabel={t('feature.chat.request.cancelRequest')}
        testId={TEST_IDS.chatCancelRequestDialog}
        confirmTestId={TEST_IDS.chatCancelRequestDialogConfirm}
        onClose={() => setConfirmingCancel(false)}
        onConfirm={handleConfirm}
      />
    </div>
  );
};
