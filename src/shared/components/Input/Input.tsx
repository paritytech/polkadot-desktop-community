import { type ComponentProps, type ReactNode } from 'react';

import { cnTw } from '@/shared/utils';

type InputProps = Omit<ComponentProps<'input'>, 'className'> & {
  leading?: ReactNode;
};

export const Input = ({ leading, style, ...rest }: InputProps) => {
  const input = (
    <input
      {...rest}
      className={cnTw(
        'h-9 w-full min-w-0 rounded-full bg-chrome-well px-4 text-sm text-chrome-text shadow-chrome-inset placeholder:text-chrome-muted focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-chrome-focus disabled:cursor-default disabled:text-chrome-faint',
        Boolean(leading) && 'ps-9',
      )}
      style={{ appRegion: 'no-drag', ...style }}
      data-no-app-focus
    />
  );

  if (!leading) {
    return input;
  }

  return (
    <div className="relative flex w-full items-center">
      <span aria-hidden className="pointer-events-none absolute start-3 flex text-chrome-muted [&_svg]:size-4">
        {leading}
      </span>
      {input}
    </div>
  );
};
