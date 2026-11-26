import { type ComponentProps, type MouseEvent } from 'react';

import { IconButton } from '@/shared/components';

type WidgetTopbarActionProps = Omit<ComponentProps<typeof IconButton>, 'size'>;

/**
 * An icon button for a widget's top bar. Its `widget-topbar-action` class is the marker DashboardGrid's drag `cancel`
 * reads, and it stops `mousedown` so a press on it does not start a card drag.
 */
export const WidgetTopbarAction = ({ onMouseDown, ...props }: WidgetTopbarActionProps) => {
  const handleMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onMouseDown?.(event);
  };

  return (
    <span className="widget-topbar-action inline-flex shrink-0 opacity-0 transition-opacity group-hover/widget:opacity-100 group-[.widget-topbar-menu-open]/widget:opacity-100 focus-within:opacity-100 motion-reduce:transition-none">
      <IconButton size="sm" {...props} onMouseDown={handleMouseDown} />
    </span>
  );
};
