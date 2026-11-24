import { Button, DropdownMenu } from '@novasamatech/tr-ui';
import { Ellipsis, Search } from 'lucide-react';
import { type ReactNode } from 'react';

import { Avatar } from './Avatar';

type RequestRoomHeaderProps = {
  /** Already-formatted display name (see `formatPeerName`). */
  name: string;
} & (
  | {
      /** Single destructive action in the overflow menu (decline / cancel / leave). */
      actionIcon: ReactNode;
      actionLabel: string;
      onAction: VoidFunction;
    }
  | { actionIcon?: never; actionLabel?: never; onAction?: never }
);

/**
 * Shared chat-header for the request rooms (incoming request, draft invitation,
 * outgoing pending): avatar + name, a search control, and, when the room
 * supplies one, an overflow menu with a single destructive action.
 */
export const RequestRoomHeader = ({ name, actionIcon, actionLabel, onAction }: RequestRoomHeaderProps) => {
  return (
    <div className="h-14 shrink-0 border-b border-stroke-primary">
      <div className="flex h-full items-center gap-2 py-2 ps-4 pe-0">
        <Avatar name={name} size="chat-header" />
        <div className="flex min-w-0 flex-1 items-center gap-2 pe-4">
          <div className="flex min-w-0 flex-1 flex-col items-start justify-center">
            <span className="w-full min-w-0 truncate text-base leading-6 font-semibold text-fg-primary">{name}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" size="icon-sm">
              <Search strokeWidth={1.75} className="size-5" />
            </Button>
            {onAction && (
              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <Ellipsis strokeWidth={1.75} className="size-5" />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                  <DropdownMenu.Item variant="destructive" onClick={onAction}>
                    {actionIcon}
                    {actionLabel}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
