import { type ComponentProps } from 'react';

import { cnTw } from '@/shared/utils';

type IconButtonProps = Omit<ComponentProps<'button'>, 'className' | 'aria-label'> & {
  label: string;
  size?: 'md' | 'sm';
  variant?: 'ghost' | 'raised' | 'primary';
};

export const IconButton = ({ label, size = 'md', variant = 'ghost', type, disabled, style, ...rest }: IconButtonProps) => {
  return (
    <button
      {...rest}
      type={type ?? 'button'}
      disabled={disabled}
      aria-label={label}
      className={cnTw(
        "relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-[color,background-color] duration-150 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chrome-focus disabled:cursor-default motion-reduce:transition-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        size === 'md' && 'size-control',
        size === 'sm' && 'size-control-sm',
        variant === 'ghost' &&
          'bg-transparent text-chrome-text hover:bg-chrome-fill active:bg-chrome-fill-strong disabled:bg-transparent disabled:text-chrome-faint aria-expanded:bg-chrome-fill-strong aria-expanded:shadow-chrome-raised',
        variant === 'raised' &&
          'bg-chrome-surface text-chrome-muted shadow-chrome-raised hover:text-chrome-text disabled:text-chrome-faint',
        !disabled &&
          variant === 'primary' &&
          'bg-(image:--chrome-primary) text-chrome-on-primary shadow-chrome-primary hover:bg-(image:--chrome-primary-hover)',
        disabled && variant === 'primary' && 'bg-chrome-well text-chrome-faint shadow-chrome-ring',
      )}
      style={{ appRegion: 'no-drag', ...style }}
      data-no-app-focus
    />
  );
};
