import { type ComponentProps } from 'react';

import { cnTw } from '@/shared/utils';

type MenuRowProps = Omit<ComponentProps<'div'>, 'className'> & {
  variant?: 'default' | 'danger';
};

// No focus ring: Radix moves focus onto the row and marks it highlighted, which draws the fill.
export const MenuRow = ({ variant = 'default', ...rest }: MenuRowProps) => {
  return (
    <div
      {...rest}
      data-no-app-focus
      className={cnTw(
        'flex min-h-control cursor-pointer items-center gap-2 rounded-xl px-3 text-sm text-chrome-text transition-colors duration-150 outline-none select-none data-[disabled]:cursor-default data-[disabled]:text-chrome-faint motion-reduce:transition-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-chrome-muted data-[disabled]:[&_svg]:text-chrome-faint',
        variant === 'default' && 'data-[highlighted]:bg-chrome-fill',
        variant === 'danger' &&
          'text-chrome-danger-ink data-[highlighted]:bg-chrome-danger-fill data-[highlighted]:text-chrome-danger-text [&_svg]:text-chrome-danger-ink data-[highlighted]:[&_svg]:text-chrome-danger-text',
      )}
    />
  );
};
