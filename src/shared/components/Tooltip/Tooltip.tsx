import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { type ComponentProps } from 'react';

import { FloatingSurface } from '../FloatingSurface/FloatingSurface';

type TooltipContentProps = Omit<ComponentProps<typeof TooltipPrimitive.Content>, 'className' | 'asChild'>;

const TooltipContent = ({ sideOffset = 6, collisionPadding = 8, style, children, ...props }: TooltipContentProps) => {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        asChild
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        style={{ transformOrigin: 'var(--radix-tooltip-content-transform-origin)', ...style }}
        {...props}
      >
        <FloatingSurface inset="tip">{children}</FloatingSurface>
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
};

/** dot.li's glass tooltip over Radix: no arrow, 6 from its trigger and 8 from the viewport edge by default. */
export const Tooltip = {
  Provider: TooltipPrimitive.Provider,
  Root: TooltipPrimitive.Root,
  Trigger: TooltipPrimitive.Trigger,
  Content: TooltipContent,
};
