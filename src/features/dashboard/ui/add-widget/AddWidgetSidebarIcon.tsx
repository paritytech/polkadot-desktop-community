import { type ReactNode } from 'react';

import { cnTw } from '@/shared/utils';

const iconSlotClassName = 'flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-[4px] text-fg-secondary';

export const AddWidgetSidebarPlaceholderIcon = ({ className }: { className?: string }) => (
  <svg
    className={className ?? 'size-4 shrink-0 text-fg-secondary'}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    <rect
      x="0.75"
      y="0.75"
      width="14.5"
      height="14.5"
      rx="3"
      ry="3"
      stroke="currentColor"
      strokeWidth="1"
      strokeDasharray="3 2"
      vectorEffect="non-scaling-stroke"
    />
  </svg>
);

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
          '**:data-[slot=app-icon]:size-4 **:data-[slot=app-icon]:rounded-sm **:data-[slot=app-icon]:bg-transparent',
          '[&_[data-slot=app-icon]_img]:size-full [&_[data-slot=app-icon]_img]:rounded-sm',
          '[&_svg]:size-4',
        )}
      >
        {children}
      </span>
    );
  }

  return <AddWidgetSidebarPlaceholderIcon />;
};
