import { Link } from '@tanstack/react-router';
import { type PropsWithChildren, type ReactNode } from 'react';

import { cnTw } from '@/shared/utils';

type SidebarLinkProps = PropsWithChildren<{
  to: string;
  icon: ReactNode;
}>;

const SidebarItem = ({ icon, to, children }: SidebarLinkProps) => {
  return (
    <Link to={to} className="block appearance-none rounded-md">
      {({ isActive }) => (
        <div
          className={cnTw(
            'flex h-8 items-center gap-2 rounded-md px-3 py-1 transition-colors',
            isActive ? 'bg-general-muted text-text-primary' : 'text-text-primary hover:bg-general-muted',
          )}
        >
          <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
          <span className="text-sm">{children}</span>
        </div>
      )}
    </Link>
  );
};

type SidebarGroupProps = PropsWithChildren<{
  title: ReactNode;
}>;

const SidebarGroup = ({ title, children }: SidebarGroupProps) => {
  return (
    <section>
      <header className="line-clamp-1 flex items-center justify-start gap-2 self-stretch px-3 py-2 text-xs leading-4 font-medium text-fg-secondary">
        {title}
      </header>
      <div className="flex flex-col">{children}</div>
    </section>
  );
};

export const Sidebar = {
  Item: SidebarItem,
  Group: SidebarGroup,
};
