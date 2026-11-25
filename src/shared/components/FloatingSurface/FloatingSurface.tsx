import { type ComponentProps } from 'react';

import { cnTw } from '@/shared/utils';

type FloatingSurfaceProps = Omit<ComponentProps<'div'>, 'className'> & {
  inset?: 'none' | 'menu' | 'tip';
};

// A layer renders in a portal, a sibling of #app, so it inherits no drag region, and Chromium hands a press on a drag
// region to the OS before the renderer sees it. `no-drag` subtracts the layer's own rect so presses land on it.
export const FloatingSurface = ({ inset = 'none', style, ...rest }: FloatingSurfaceProps) => {
  return (
    <div
      {...rest}
      className={cnTw(
        'z-50 animate-float-in bg-chrome-surface text-chrome-text shadow-chrome-pop backdrop-blur-2xl backdrop-saturate-150 outline-none data-[side=top]:[--float-slide:0.5rem] data-[state=closed]:animate-float-out motion-reduce:[animation-duration:0.01ms]',
        inset === 'none' && 'rounded-2xl',
        inset === 'menu' && 'min-w-48 overflow-y-auto rounded-2xl p-1.5',
        inset === 'tip' && 'rounded-xl px-2.5 py-1.5 text-xs',
      )}
      style={{ ...style, appRegion: 'no-drag' }}
    />
  );
};
