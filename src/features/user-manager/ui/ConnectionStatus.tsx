import { WifiOff } from 'lucide-react';

import PolkadotLogo from '@/shared/assets/images/logo-icon.svg?jsx';
import { Spinner } from '@/shared/components';
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
      className={cnTw(
        'relative h-8 w-[60px] shrink-0 overflow-hidden rounded-full border border-general-border bg-elevated transition-colors select-none hover:bg-bg-action-secondary-hover',
        className,
      )}
      style={{ appRegion: 'no-drag' }}
    >
      {state === 'connected' && (
        <span className="absolute top-[6px] left-[6px] flex size-5 items-center justify-center">
          <PolkadotLogo className="size-[18px] text-text-primary" />
        </span>
      )}
      {state === 'reconnecting' && (
        <span className="absolute top-[6px] left-[6px] flex size-5 items-center justify-center text-text-primary">
          <Spinner size={18} />
        </span>
      )}
      {state === 'no-connection' && (
        <span className="absolute top-[6px] left-[6px] flex size-5 items-center justify-center">
          <PolkadotLogo className="size-[18px] text-text-primary opacity-50" />
          <span
            aria-hidden
            className="absolute h-[1px] w-6 rotate-45 bg-text-primary"
            style={{ boxShadow: '0 -1.5px 0 hsl(var(--elevated))' }}
          />
        </span>
      )}
      {state === 'offline' && (
        <span className="absolute top-[6px] left-[6px] flex size-5 items-center justify-center text-text-secondary">
          <WifiOff className="size-[18px]" />
        </span>
      )}
      <span
        className={cnTw(
          'absolute top-1/2 right-px flex size-7 -translate-y-1/2 items-center justify-center rounded-full',
          state === 'no-connection' ? 'bg-avatar-purple-bg' : 'bg-avatar-violet-bg',
        )}
      >
        <span
          className={cnTw(
            'text-sm leading-none font-semibold uppercase',
            state === 'no-connection' ? 'text-avatar-purple-fg' : 'text-avatar-violet-fg',
          )}
        >
          {letter}
        </span>
      </span>
    </div>
  );
};
