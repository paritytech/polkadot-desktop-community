import { useIntl } from 'react-intl';
import { useObservable } from 'react-rx';

import { IconButton } from '@/shared/components';
import { isElectron } from '@/shared/env';
import { PhoneIcon, VideoIcon } from '@/shared/icons';
import { useRxState } from '@/shared/rxstate';
import { TEST_IDS } from '@/shared/test-ids';
import { type CallPurpose, type ChatSession } from '@/domains/chat';
import { callActivityState } from '../state/callActivity';

type Props = { session: ChatSession };

export const CallButtons = ({ session }: Props) => {
  const intl = useIntl();
  const peerName = useObservable(session.name, '');
  const [activity] = useRxState(callActivityState);
  // Only one call at a time — disabled in every chat, not just this peer's.
  const inCall = activity.status === 'active';

  const handleCall = (purpose: CallPurpose) => {
    if (!isElectron()) return;
    // The disabled buttons cover pointer input; this covers programmatic calls.
    if (inCall) return;
    const offerId = crypto.randomUUID();
    console.info('[CALL] outgoing %s call → %s (offerId=%s, sessionId=%s)', purpose, peerName, offerId, session.sessionId);
    void window.App.openCallWindow(
      { direction: 'outgoing', purpose, offerId, peerName, peerSessionId: session.sessionId },
      {
        turnHost: import.meta.env['VITE_WEBRTC_TURN_HOST'],
        turnSecret: import.meta.env['VITE_WEBRTC_TURN_SECRET'],
      },
    );
  };

  if (!isElectron()) return null;

  return (
    <>
      <IconButton
        disabled={inCall}
        data-testid={TEST_IDS.callAudioButton}
        label={intl.formatMessage({ id: 'feature.call.audioCall' })}
        onClick={() => handleCall('audio')}
      >
        <PhoneIcon className="size-5" strokeWidth={1.75} />
      </IconButton>
      <IconButton
        disabled={inCall}
        data-testid={TEST_IDS.callVideoButton}
        label={intl.formatMessage({ id: 'feature.call.videoCall' })}
        onClick={() => handleCall('video')}
      >
        <VideoIcon className="size-5" strokeWidth={1.75} />
      </IconButton>
    </>
  );
};
