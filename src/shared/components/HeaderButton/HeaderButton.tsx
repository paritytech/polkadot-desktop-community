import { type PropsWithChildren, type RefAttributes } from 'react';

import { cnTw } from '@/shared/utils';

export const iconBase = 'shrink-0 text-fg-secondary';

type Props = RefAttributes<HTMLButtonElement> &
  PropsWithChildren<{
    active?: boolean;
    variant?: 'default' | 'icon';
    testId?: string;
    onFocus?: () => void;
    onBlur?: () => void;
    onClick?: () => void;
  }>;

export const HeaderButton = ({
  ref,
  active,
  variant = 'default',
  children,
  testId = 'HeaderButton',
  onClick,
  onFocus,
  onBlur,
}: Props) => {
  return (
    <button
      ref={ref}
      className={cnTw(
        'relative flex appearance-none items-center justify-center rounded-lg text-xs select-none',
        'cursor-pointer bg-transparent transition-colors hover:bg-bg-action-secondary-hover',
        active ? 'bg-general-muted font-semibold text-text-primary' : 'text-fg-secondary',
        variant === 'icon' && 'h-8 w-8 shrink-0',
        variant === 'default' && 'h-8 px-2',
      )}
      style={{ appRegion: 'no-drag' }}
      data-testid={testId}
      onClick={onClick}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {children}
    </button>
  );
};
