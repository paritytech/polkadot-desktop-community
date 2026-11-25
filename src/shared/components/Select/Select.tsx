import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { type ComponentProps } from 'react';

import { FloatingSurface } from '../FloatingSurface/FloatingSurface';
import { MenuRow } from '../MenuRow/MenuRow';

type SelectTriggerProps = Omit<ComponentProps<typeof SelectPrimitive.Trigger>, 'className' | 'asChild'>;

type SelectContentProps = Omit<ComponentProps<typeof SelectPrimitive.Content>, 'className' | 'asChild' | 'position'>;

type SelectItemProps = Omit<ComponentProps<typeof SelectPrimitive.Item>, 'className' | 'asChild'>;

const SelectTrigger = ({ style, children, ...props }: SelectTriggerProps) => {
  return (
    <SelectPrimitive.Trigger
      {...props}
      className="inline-flex h-9 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-full bg-chrome-well px-4 text-sm text-chrome-text shadow-chrome-inset focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-chrome-focus disabled:cursor-default disabled:text-chrome-faint data-[placeholder]:text-chrome-muted"
      style={{ ...style, appRegion: 'no-drag' }}
      data-no-app-focus
    >
      {children}
      <SelectPrimitive.Icon>
        <ChevronDown className="size-4 text-chrome-muted" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
};

// While closed, Radix renders the items into a detached fragment to read the chosen item's text for `Value`, so the
// surface and the viewport stay inside `Content`, where that fragment still reaches them.
const SelectContent = ({ sideOffset = 8, style, children, ...props }: SelectContentProps) => {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        asChild
        position="popper"
        sideOffset={sideOffset}
        style={{
          transformOrigin: 'var(--radix-select-content-transform-origin)',
          maxHeight: 'var(--radix-select-content-available-height)',
          minWidth: 'var(--radix-select-trigger-width)',
          ...style,
        }}
        {...props}
      >
        <FloatingSurface inset="menu">
          <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
        </FloatingSurface>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
};

const SelectItem = ({ children, ...props }: SelectItemProps) => {
  return (
    <SelectPrimitive.Item asChild {...props}>
      <MenuRow>
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        <SelectPrimitive.ItemIndicator className="ms-auto flex">
          <Check />
        </SelectPrimitive.ItemIndicator>
      </MenuRow>
    </SelectPrimitive.Item>
  );
};

/** dot.li's select over Radix: a field-pill trigger and a glass listbox 8 below it, at least as wide as the trigger. */
export const Select = {
  Root: SelectPrimitive.Root,
  Trigger: SelectTrigger,
  Value: SelectPrimitive.Value,
  Content: SelectContent,
  Item: SelectItem,
};
