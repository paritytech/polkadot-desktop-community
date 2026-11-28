import { type ReactNode } from 'react';

import { SquareDashedIcon } from '@/shared/icons';
import { cnTw } from '@/shared/utils';

const iconSlotClassName = cnTw('flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-sm text-fg-secondary');

type AddWidgetSidebarIconProps = {
  alt: string;
  imageUrl?: string | null;
  children?: ReactNode;
};

export const AddWidgetSidebarIcon = ({ alt, imageUrl, children }: AddWidgetSidebarIconProps) => {
  if (imageUrl) {
    return (
      <span className={iconSlotClassName}>
        <img src={imageUrl} alt={alt} className="size-full object-cover" draggable={false} />
      </span>
    );
  }

  if (children) {
    return (
      <span
        className={cnTw(
          iconSlotClassName,
          '**:data-[slot=app-icon]:size-4 **:data-[slot=app-icon]:rounded-sm **:data-[slot=app-icon]:bg-transparent **:data-[slot=app-icon]:shadow-none',
          '[&_[data-slot=app-icon]_img]:size-full [&_[data-slot=app-icon]_img]:rounded-sm',
          '[&_svg]:size-4',
        )}
      >
        {children}
      </span>
    );
  }

  return <SquareDashedIcon className="size-4 shrink-0 text-fg-secondary" />;
};
