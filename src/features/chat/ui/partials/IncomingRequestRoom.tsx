import { X } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { type P2PChatRequest, p2pService } from '@/domains/chat';
import { chatService } from '../../service';

import { DateSeparator } from './MessageBubble';
import { RequestBanner } from './RequestBanner';
import { RequestRoomHeader } from './RequestRoomHeader';
import { RequestRoomNotice } from './RequestRoomNotice';
import { RoomPane } from './RoomPane';

type IncomingRequestRoomProps = {
  request: P2PChatRequest;
  hideByDefault: boolean;
  onReveal: (request: P2PChatRequest) => void;
} & ({ cancelled: true } | { cancelled?: false; disabled?: boolean; onAccept: VoidFunction; onDecline: VoidFunction });

export const IncomingRequestRoom = (props: IncomingRequestRoomProps) => {
  const { request, hideByDefault, onReveal } = props;
  const actions = props.cancelled ? null : props;
  const { t } = useTranslation();
  const name = chatService.formatPeerName(request.peerUsername, request.peerId);

  const hasMessage = Boolean(request.welcomeMessage);
  const isHidden = p2pService.isRequestMessageHidden(request, hideByDefault);
  const bannerPlacement = hasMessage && !isHidden ? 'bottom' : 'top';

  const handleReveal = useCallback(() => onReveal(request), [onReveal, request]);

  return (
    <div className="flex min-w-111 flex-1">
      <RoomPane>
        {actions ? (
          <RequestRoomHeader
            name={name}
            actionIcon={<X />}
            actionLabel={t('feature.chat.request.decline')}
            onAction={actions.onDecline}
          />
        ) : (
          <RequestRoomHeader name={name} />
        )}

        {actions && bannerPlacement === 'top' && (
          <RequestBanner
            name={name}
            placement="top"
            disabled={actions.disabled}
            acceptTestId={TEST_IDS.chatRequestAcceptButton}
            onAccept={actions.onAccept}
            onDecline={actions.onDecline}
          />
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 py-4">
          {hasMessage && (
            <>
              <DateSeparator text={chatService.formatRequestTime(request.timestamp)} />
              <div className="flex w-full flex-col items-start">
                <div className="flex max-w-130 items-end gap-2 rounded-2xl bg-bg-surface-nested px-3 pt-2 pb-3">
                  <p className="text-base text-fg-primary">
                    {isHidden ? t('feature.chat.request.messageHiddenFull') : request.welcomeMessage}
                  </p>
                </div>
                {isHidden && (
                  <span className="mt-1 flex">
                    <Button variant="ghost" size="sm" onClick={handleReveal}>
                      {t('feature.chat.request.viewMessage')}
                    </Button>
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {actions && bannerPlacement === 'bottom' && (
          <RequestBanner
            name={name}
            placement="bottom"
            disabled={actions.disabled}
            acceptTestId={TEST_IDS.chatRequestAcceptButton}
            onAccept={actions.onAccept}
            onDecline={actions.onDecline}
          />
        )}

        {!actions && <RequestRoomNotice textId="feature.chat.request.cancelledByPeer" name={name} />}
      </RoomPane>
    </div>
  );
};
