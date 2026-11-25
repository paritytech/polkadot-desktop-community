import { type ComponentProps } from 'react';

import { cnTw } from '@/shared/utils';

type DialogScrimProps = Omit<ComponentProps<'div'>, 'className'>;

// A press on the scrim over the window's drag region must close the dialog, not drag the window.
export const DialogScrim = ({ style, ...rest }: DialogScrimProps) => {
  return (
    <div
      {...rest}
      className="fixed inset-0 z-50 animate-scrim-in bg-chrome-scrim data-[state=closed]:animate-scrim-out motion-reduce:[animation-duration:0.01ms] motion-reduce:data-[state=closed]:[animation-duration:0.01ms]"
      style={{ ...style, appRegion: 'no-drag' }}
    />
  );
};

type DialogCardProps = Omit<ComponentProps<'div'>, 'className'> & {
  width?: 'sm' | 'md' | 'lg' | 'xl';
  height?: 'content' | 'tall';
};

// Centred by `inset-0 m-auto` with a definite or fit height, so the entry animation's `translate` never fights a
// centring translate.
export const DialogCard = ({ width = 'sm', height = 'content', style, ...rest }: DialogCardProps) => {
  return (
    <div
      {...rest}
      className={cnTw(
        'fixed inset-0 z-50 m-auto flex max-h-[calc(100dvh-3rem)] w-[calc(100%-2rem)] animate-dialog-in flex-col gap-4 rounded-3xl bg-(image:--chrome-glass) p-5 text-chrome-text shadow-chrome-pop backdrop-blur-2xl backdrop-saturate-150 outline-none data-[state=closed]:animate-dialog-out motion-reduce:[animation-duration:0.01ms] motion-reduce:data-[state=closed]:[animation-duration:0.01ms]',
        width === 'sm' && 'max-w-120',
        width === 'md' && 'max-w-160',
        width === 'lg' && 'max-w-200',
        width === 'xl' && 'max-w-256',
        height === 'content' && 'h-fit overflow-y-auto',
        height === 'tall' && 'h-150 overflow-hidden',
      )}
      style={{ ...style, appRegion: 'no-drag' }}
    />
  );
};

type DialogHeaderProps = Omit<ComponentProps<'div'>, 'className'>;

export const DialogHeader = (props: DialogHeaderProps) => {
  return <div {...props} className="flex flex-col gap-2 text-start" />;
};

type DialogFooterProps = Omit<ComponentProps<'div'>, 'className'>;

export const DialogFooter = (props: DialogFooterProps) => {
  return <div {...props} className="grid auto-cols-fr grid-flow-col gap-2" />;
};

type DialogHeadingProps = Omit<ComponentProps<'h2'>, 'className'>;

export const DialogHeading = (props: DialogHeadingProps) => {
  return <h2 {...props} className="pe-8 text-lg font-semibold text-chrome-text" />;
};

type DialogTextProps = Omit<ComponentProps<'p'>, 'className'>;

export const DialogText = (props: DialogTextProps) => {
  return <p {...props} className="text-sm text-chrome-muted" />;
};
