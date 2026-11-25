import { type ComponentProps } from 'react';

import { cnTw } from '@/shared/utils';

type IconButtonProps = Omit<ComponentProps<'button'>, 'className' | 'aria-label'> & {
  label: string;
  size?: 'md' | 'sm' | 'xs';
};

export const IconButton = ({ label, size = 'md', type, style, ...rest }: IconButtonProps) => {
  return (
    <button
      {...rest}
      type={type ?? 'button'}
      aria-label={label}
      className={cnTw(
        "relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-transparent text-chrome-text transition-[color,background-color] duration-150 select-none hover:bg-chrome-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chrome-focus active:bg-chrome-fill-strong disabled:cursor-default disabled:bg-transparent disabled:text-chrome-faint aria-expanded:bg-chrome-fill-strong aria-expanded:shadow-chrome-raised motion-reduce:transition-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        size === 'md' && 'size-9',
        size === 'sm' && 'size-8',
        size === 'xs' && 'size-6',
      )}
      style={{ appRegion: 'no-drag', ...style }}
      data-no-app-focus
    />
  );
};
