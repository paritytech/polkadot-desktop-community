import { useIntl } from 'react-intl';

import { isElectron } from '@/shared/env';
import { useRxState } from '@/shared/rxstate';
import { cnTw } from '@/shared/utils';
import { type ChatSession } from '@/domains/chat';
import { callActivityState } from '../state/callActivity';

type Props = { session: ChatSession };

/**
 * Return-to-call bar shown at the top of the call peer's chat view while a call
 * runs in its separate window. Green, full-width; click focuses the call window.
 */
export const CallActivityBar = ({ session }: Props) => {
  const intl = useIntl();
  const [activity] = useRxState(callActivityState);

  if (activity.status !== 'active') return null;
  // Scope to the peer's conversation when the session is known.
  const scopedSessionId = activity.sessionId;
  if (scopedSessionId !== null && scopedSessionId !== undefined && scopedSessionId !== session.sessionId) {
    return null;
  }

  const handleReturn = () => {
    if (isElectron()) window.App.focusCallWindow();
  };

  return (
    <button
      type="button"
      aria-label={intl.formatMessage({ id: 'feature.call.returnToCall' })}
      className={cnTw(
        'flex h-control w-full shrink-0 items-center justify-center bg-fg-success',
        'text-sm font-semibold text-fg-primary-inverted',
      )}
      onClick={handleReturn}
    >
      {activity.peerName}
    </button>
  );
};
