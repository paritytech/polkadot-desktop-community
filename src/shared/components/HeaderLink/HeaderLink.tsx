import { Link } from '@tanstack/react-router';
import { type MouseEventHandler, type PropsWithChildren, type RefAttributes } from 'react';

import { cnTw } from '@/shared/utils';

type Props = RefAttributes<HTMLAnchorElement> &
  PropsWithChildren<{
    to: string;
    variant?: 'default' | 'icon';
    testId?: string;
    onClick?: MouseEventHandler<HTMLAnchorElement>;
    disableActive?: boolean;
  }>;

export const HeaderLink = ({ ref, to, variant = 'default', children, testId = 'HeaderLink', onClick, disableActive }: Props) => {
  return (
    <Link
      ref={ref}
      to={to}
      className="inline-flex appearance-none items-center justify-center rounded-full text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chrome-focus"
      style={{ appRegion: 'no-drag' }}
      data-testid={testId}
      data-no-app-focus
      onClick={onClick}
    >
      {({ isActive }) => {
        const showActive = isActive && !disableActive;
        return (
          <div
            className={cnTw(
              'relative flex shrink-0 cursor-pointer appearance-none items-center justify-center rounded-full bg-transparent text-chrome-text transition-colors duration-150 select-none hover:bg-chrome-fill active:bg-chrome-fill-strong',
              variant === 'icon' && 'size-9',
              variant === 'default' && 'h-9 px-3 text-xs',
              showActive && 'bg-chrome-fill-strong font-semibold shadow-chrome-raised hover:bg-chrome-fill-strong',
            )}
          >
            {children}
          </div>
        );
      }}
    </Link>
  );
};
