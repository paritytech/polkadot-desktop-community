import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { type ComponentProps } from 'react';

import { FloatingSurface } from '../FloatingSurface/FloatingSurface';
import { MenuDivider } from '../MenuRow/MenuDivider';
import { MenuRow } from '../MenuRow/MenuRow';

type DropdownMenuContentProps = Omit<ComponentProps<typeof DropdownMenuPrimitive.Content>, 'className' | 'asChild'>;

type DropdownMenuItemProps = Omit<ComponentProps<typeof DropdownMenuPrimitive.Item>, 'className' | 'asChild'> & {
  variant?: 'default' | 'danger';
};

type DropdownMenuSeparatorProps = Omit<ComponentProps<typeof DropdownMenuPrimitive.Separator>, 'className' | 'asChild'>;

const DropdownMenuContent = ({ sideOffset = 8, collisionPadding = 8, style, children, ...props }: DropdownMenuContentProps) => {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        asChild
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        style={{
          transformOrigin: 'var(--radix-dropdown-menu-content-transform-origin)',
          maxHeight: 'var(--radix-dropdown-menu-content-available-height)',
          ...style,
        }}
        {...props}
      >
        <FloatingSurface inset="menu">{children}</FloatingSurface>
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
};

const DropdownMenuItem = ({ variant, children, ...props }: DropdownMenuItemProps) => {
  return (
    <DropdownMenuPrimitive.Item asChild {...props}>
      <MenuRow variant={variant}>{children}</MenuRow>
    </DropdownMenuPrimitive.Item>
  );
};

const DropdownMenuSeparator = (props: DropdownMenuSeparatorProps) => {
  return (
    <DropdownMenuPrimitive.Separator asChild {...props}>
      <MenuDivider />
    </DropdownMenuPrimitive.Separator>
  );
};

/**
 * dot.li's glass dropdown menu over Radix: rows on the shared menu surface, 8 from its trigger and from the window edge
 * by default.
 */
export const DropdownMenu = {
  Root: DropdownMenuPrimitive.Root,
  Trigger: DropdownMenuPrimitive.Trigger,
  Content: DropdownMenuContent,
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
};
