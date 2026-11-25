import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import { type ComponentProps } from 'react';

import { FloatingSurface } from '../FloatingSurface/FloatingSurface';
import { MenuDivider } from '../MenuRow/MenuDivider';
import { MenuRow } from '../MenuRow/MenuRow';

type ContextMenuContentProps = Omit<ComponentProps<typeof ContextMenuPrimitive.Content>, 'className' | 'asChild'>;

type ContextMenuItemProps = Omit<ComponentProps<typeof ContextMenuPrimitive.Item>, 'className' | 'asChild'> & {
  variant?: 'default' | 'danger';
};

type ContextMenuSeparatorProps = Omit<ComponentProps<typeof ContextMenuPrimitive.Separator>, 'className' | 'asChild'>;

const ContextMenuContent = ({ style, children, ...props }: ContextMenuContentProps) => {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        asChild
        style={{
          transformOrigin: 'var(--radix-context-menu-content-transform-origin)',
          maxHeight: 'var(--radix-context-menu-content-available-height)',
          ...style,
        }}
        {...props}
      >
        <FloatingSurface inset="menu">{children}</FloatingSurface>
      </ContextMenuPrimitive.Content>
    </ContextMenuPrimitive.Portal>
  );
};

const ContextMenuItem = ({ variant, children, ...props }: ContextMenuItemProps) => {
  return (
    <ContextMenuPrimitive.Item asChild {...props}>
      <MenuRow variant={variant}>{children}</MenuRow>
    </ContextMenuPrimitive.Item>
  );
};

const ContextMenuSeparator = (props: ContextMenuSeparatorProps) => {
  return (
    <ContextMenuPrimitive.Separator asChild {...props}>
      <MenuDivider />
    </ContextMenuPrimitive.Separator>
  );
};

/** dot.li's glass context menu over Radix: rows on the shared menu surface, opened at the pointer. */
export const ContextMenu = {
  Root: ContextMenuPrimitive.Root,
  Trigger: ContextMenuPrimitive.Trigger,
  Content: ContextMenuContent,
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
};
