import { WifiOff } from 'lucide-react';

import PolkadotLogo from '@/shared/assets/images/logo-icon.svg?jsx';
import { Spinner } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { cnTw } from '@/shared/utils';
import { type PeopleChainStatus } from '@/aggregates/network-settings';

// Badge display state = the shared chain status (single source of truth in the
// network-settings aggregate) plus the signed-out case the badge owns.
export type ConnectionState = PeopleChainStatus | 'no-connection';

type Props = {
  state: ConnectionState;
  letter: string;
  className?: string;
};

export const ConnectionStatus = ({ state, letter, className }: Props) => {
  return (
    <div
      data-testid={TEST_IDS.userConnectionStatus}
      data-state={state}
      className={cnTw(
        'relative h-control w-15 shrink-0 overflow-hidden rounded-full bg-chrome-fill transition-colors select-none hover:bg-chrome-fill-strong',
        className,
      )}
      style={{ appRegion: 'no-drag' }}
    >
      {state === 'connected' && (
        <span className="absolute start-1.5 top-1.5 flex size-5 items-center justify-center">
          <PolkadotLogo className="size-4.5 text-chrome-text" />
        </span>
      )}
      {state === 'reconnecting' && (
        <span className="absolute start-1.5 top-1.5 flex size-5 items-center justify-center text-chrome-text">
          <Spinner size={18} />
        </span>
      )}
      {state === 'no-connection' && (
        <span className="absolute start-1.5 top-1.5 flex size-5 items-center justify-center">
          <PolkadotLogo className="size-4.5 text-chrome-text opacity-50" />
          <span
            aria-hidden
            className="absolute h-px w-6 rotate-45 bg-chrome-text"
            style={{ boxShadow: '0 -1.5px 0 var(--chrome-top)' }}
          />
        </span>
      )}
      {state === 'offline' && (
        <span className="absolute start-1.5 top-1.5 flex size-5 items-center justify-center text-chrome-muted">
          <WifiOff className="size-4.5" />
        </span>
      )}
      <span
        className={cnTw(
          'absolute end-px top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full',
          state === 'no-connection' ? 'bg-avatar-bg-opal' : 'bg-avatar-bg-amethyst',
        )}
      >
        <span
          className={cnTw(
            'text-sm leading-none font-semibold uppercase',
            state === 'no-connection' ? 'text-avatar-fg-opal' : 'text-avatar-fg-amethyst',
          )}
        >
          {letter}
        </span>
      </span>
    </div>
  );
};
