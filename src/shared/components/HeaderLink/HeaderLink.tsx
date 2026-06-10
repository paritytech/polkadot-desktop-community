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
      className="inline-flex appearance-none items-center justify-center rounded-lg text-xs"
      style={{ appRegion: 'no-drag' }}
      data-testid={testId}
      onClick={onClick}
    >
      {({ isActive }) => {
        const showActive = isActive && !disableActive;
        return (
          <div
            className={cnTw(
              'flex appearance-none items-center justify-center rounded-lg text-xs select-none',
              'cursor-pointer bg-transparent transition-colors hover:bg-bg-action-secondary-hover',
              showActive ? 'bg-general-muted font-semibold text-text-primary' : 'text-fg-secondary',
              variant === 'icon' && 'h-8 w-8 shrink-0',
              variant === 'default' && 'h-8 px-2',
            )}
          >
            {children}
          </div>
        );
      }}
    </Link>
  );
};
