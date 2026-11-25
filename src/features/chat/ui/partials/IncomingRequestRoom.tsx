import { X } from 'lucide-react';
import { useCallback } from 'react';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { type P2PChatRequest, p2pService } from '@/domains/chat';
import { chatService } from '../../service';

import { RequestBanner } from './RequestBanner';
import { RequestRoomHeader } from './RequestRoomHeader';
import { RequestRoomNotice } from './RequestRoomNotice';

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
    <div className="flex min-w-111 flex-1 flex-col overflow-hidden rounded-xl border border-stroke-primary bg-bg-surface-container">
      {actions ? (
        <RequestRoomHeader
          name={name}
          actionIcon={<X className="me-2 size-4" />}
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
            <div className="flex w-full items-center justify-center py-2">
              <span className="text-sm leading-4.5 text-fg-tertiary">{chatService.formatRequestTime(request.timestamp)}</span>
            </div>
            <div className="flex w-full flex-col items-start">
              <div className="flex max-w-130 items-end gap-2 rounded-2xl bg-bg-surface-nested px-3 py-2">
                <p className="text-base leading-5 text-fg-primary">
                  {isHidden ? t('feature.chat.request.messageHiddenFull') : request.welcomeMessage}
                </p>
              </div>
              {isHidden && (
                <button
                  className="mt-1 rounded text-sm leading-5 font-medium text-fg-link transition-colors hover:text-fg-link-hover"
                  onClick={handleReveal}
                >
                  {t('feature.chat.request.viewMessage')}
                </button>
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
    </div>
  );
};
