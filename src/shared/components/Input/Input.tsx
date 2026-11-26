import { type ComponentProps, type ReactNode } from 'react';

import { cnTw } from '@/shared/utils';

type InputProps = Omit<ComponentProps<'input'>, 'className'> & {
  leading?: ReactNode;
  trailing?: ReactNode;
};

export const Input = ({ leading, trailing, style, ...rest }: InputProps) => (
  <div
    className={cnTw(
      'relative flex h-control w-full min-w-0 items-center gap-2 rounded-full bg-chrome-well px-3 shadow-chrome-inset has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-0 has-[input:focus-visible]:outline-chrome-focus',
      Boolean(trailing) && 'pe-1',
    )}
  >
    {leading ? (
      <span aria-hidden className="flex shrink-0 text-chrome-muted [&_svg]:size-4">
        {leading}
      </span>
    ) : null}
    <input
      {...rest}
      className="h-full min-w-0 flex-1 bg-transparent text-sm text-chrome-text outline-none placeholder:text-chrome-muted disabled:cursor-default disabled:text-chrome-faint"
      style={{ appRegion: 'no-drag', ...style }}
      data-no-app-focus
    />
    {trailing ? <div className="flex shrink-0 items-center gap-1">{trailing}</div> : null}
  </div>
);
