import { type ComponentProps } from 'react';

import { cnTw } from '@/shared/utils';

type ButtonProps = Omit<ComponentProps<'button'>, 'className'> & {
  variant?: 'secondary' | 'primary' | 'danger' | 'ghost';
  size?: 'md' | 'sm';
  block?: boolean;
};

export const Button = ({ variant = 'secondary', size = 'md', block, type, disabled, style, ...rest }: ButtonProps) => {
  return (
    <button
      {...rest}
      type={type ?? 'button'}
      disabled={disabled}
      className={cnTw(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap transition-[background,box-shadow,scale] duration-150 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chrome-focus active:scale-97 motion-reduce:transition-none motion-reduce:active:scale-100 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        size === 'md' && 'h-9 px-4 text-sm has-[>svg:first-child]:ps-3',
        size === 'sm' && 'h-7 px-3 text-xs',
        block && 'w-full',
        !disabled && variant === 'secondary' && 'bg-chrome-fill text-chrome-text shadow-chrome-ring hover:bg-chrome-fill-strong',
        !disabled &&
          variant === 'primary' &&
          'bg-(image:--chrome-primary) font-semibold text-chrome-on-primary shadow-chrome-primary hover:bg-(image:--chrome-primary-hover)',
        !disabled &&
          variant === 'danger' &&
          'bg-chrome-danger-fill text-chrome-danger-text shadow-chrome-danger hover:bg-chrome-danger-fill-strong',
        !disabled && variant === 'ghost' && 'bg-transparent text-chrome-text hover:bg-chrome-fill active:bg-chrome-fill-strong',
        disabled && variant === 'ghost' && 'cursor-default text-chrome-faint active:scale-100',
        disabled && variant !== 'ghost' && 'cursor-default bg-chrome-well text-chrome-faint shadow-chrome-ring active:scale-100',
      )}
      style={{ appRegion: 'no-drag', ...style }}
      data-no-app-focus
    />
  );
};
