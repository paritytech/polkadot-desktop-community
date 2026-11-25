import { type PropsWithChildren, type RefAttributes } from 'react';

import { cnTw } from '@/shared/utils';

export const iconBase = 'shrink-0';

type Props = RefAttributes<HTMLButtonElement> &
  PropsWithChildren<{
    active?: boolean;
    disabled?: boolean;
    variant?: 'default' | 'icon';
    testId?: string;
    // Icon-only buttons have no text node, so the accessible name must land on
    // the <button> itself — a label on the <svg> is not exposed reliably.
    ariaLabel?: string;
    onFocus?: () => void;
    onBlur?: () => void;
    onClick?: () => void;
  }>;

export const HeaderButton = ({
  ref,
  active,
  disabled,
  variant = 'default',
  children,
  testId = 'HeaderButton',
  ariaLabel,
  onClick,
  onFocus,
  onBlur,
}: Props) => {
  return (
    <button
      ref={ref}
      type="button"
      className={cnTw(
        'relative flex shrink-0 cursor-pointer appearance-none items-center justify-center rounded-full bg-transparent text-chrome-text transition-colors duration-150 select-none hover:bg-chrome-fill active:bg-chrome-fill-strong',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chrome-focus',
        'disabled:cursor-default disabled:bg-transparent disabled:text-chrome-faint',
        variant === 'icon' && 'size-9',
        variant === 'default' && 'h-9 px-3 text-xs',
        active && 'bg-chrome-fill-strong font-semibold shadow-chrome-raised hover:bg-chrome-fill-strong',
      )}
      style={{ appRegion: 'no-drag' }}
      disabled={disabled}
      aria-label={ariaLabel}
      data-no-app-focus
      data-testid={testId}
      onClick={onClick}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {children}
    </button>
  );
};
