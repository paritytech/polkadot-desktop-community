import { type ComponentProps, type MouseEvent, type ReactNode, useRef } from 'react';

import { cnTw } from '@/shared/utils';

type InputProps = Omit<ComponentProps<'input'>, 'className'> & {
  leading?: ReactNode;
  trailing?: ReactNode;
};

export const Input = ({ leading, trailing, style, ...rest }: InputProps) => {
  const leadingRef = useRef<HTMLSpanElement>(null);

  // The wrapper owns the padding and the leading icon, so a press there would otherwise land on a non-focusable box.
  const focusField = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    const onWrapper = target === event.currentTarget;
    const onLeading = target instanceof Node && Boolean(leadingRef.current?.contains(target));
    if (!onWrapper && !onLeading) {
      return;
    }

    event.preventDefault();
    event.currentTarget.querySelector('input')?.focus();
  };

  return (
    <div
      className={cnTw(
        'flex h-control w-full min-w-0 items-center gap-2 rounded-full bg-chrome-well px-3 shadow-chrome-inset has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-0 has-[input:focus-visible]:outline-chrome-focus',
        Boolean(trailing) && 'pe-1',
      )}
      onMouseDown={focusField}
    >
      {leading ? (
        <span ref={leadingRef} aria-hidden className="flex shrink-0 text-chrome-muted [&_svg]:size-4">
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
};
