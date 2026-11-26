import { Ellipsis } from 'lucide-react';
import { type ReactNode } from 'react';

import { DropdownMenu, IconButton, PaneHeader } from '@/shared/components';
import { useTranslation } from '@/shared/translation';

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
 * outgoing pending): avatar + name and, when the room
 * supplies one, an overflow menu with a single destructive action.
 */
export const RequestRoomHeader = ({ name, actionIcon, actionLabel, onAction }: RequestRoomHeaderProps) => {
  const { t } = useTranslation();

  return (
    <PaneHeader
      icon={<Avatar name={name} size="24" />}
      actions={
        onAction ? (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <IconButton label={t('feature.chat.roomActions')}>
                <Ellipsis />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item variant="danger" onClick={onAction}>
                {actionIcon}
                {actionLabel}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        ) : undefined
      }
    >
      {name}
    </PaneHeader>
  );
};
