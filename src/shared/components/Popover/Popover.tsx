import * as PopoverPrimitive from '@radix-ui/react-popover';
import { type ComponentProps } from 'react';

import { FloatingSurface } from '../FloatingSurface/FloatingSurface';
import { BodyLockSweep } from '../_helpers/BodyLockSweep';

type PopoverContentProps = Omit<ComponentProps<typeof PopoverPrimitive.Content>, 'className' | 'asChild'>;

const PopoverContent = ({ sideOffset = 8, style, children, ...props }: PopoverContentProps) => {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        asChild
        sideOffset={sideOffset}
        style={{ transformOrigin: 'var(--radix-popover-content-transform-origin)', ...style }}
        {...props}
      >
        <FloatingSurface inset="none">
          <BodyLockSweep />
          {children}
        </FloatingSurface>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
};

/** dot.li's glass popover over Radix: the content floats on the shared surface, 8 from its trigger by default. */
export const Popover = {
  Root: PopoverPrimitive.Root,
  Trigger: PopoverPrimitive.Trigger,
  Anchor: PopoverPrimitive.Anchor,
  Content: PopoverContent,
};
