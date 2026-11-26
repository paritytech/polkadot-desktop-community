import { type ComponentProps } from 'react';

type MenuDividerProps = Omit<ComponentProps<'div'>, 'className'>;

export const MenuDivider = (props: MenuDividerProps) => {
  return <div {...props} className="-mx-1.5 my-1.5 h-px bg-chrome-line" />;
};
