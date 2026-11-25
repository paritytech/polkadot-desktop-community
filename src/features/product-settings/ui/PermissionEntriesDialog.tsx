import { type ReactNode } from 'react';

import { Dialog } from '@/shared/components';
import { cnTw } from '@/shared/utils';
import { type PermissionStatus } from '@/domains/product';
import { PermissionStatusDropdown } from '@/widgets/Permission';

export type PermissionEntry = {
  key: string;
  label: string;
  status: PermissionStatus;
};

type Props = {
  open: boolean;
  title: string;
  icon?: ReactNode;
  entries: PermissionEntry[];
  onOpenChange: (open: boolean) => void;
  onStatusChange: (key: string, status: PermissionStatus) => void;
};

// Shared shell for the per-product access dialogs (alias contexts, web domains):
// a titled dialog listing entries, each with an optional icon, label, and status dropdown.
// Rows with an icon are 64px tall; icon-less rows (e.g. web domains) are 48px.
export const PermissionEntriesDialog = ({ open, title, icon, entries, onOpenChange, onStatusChange }: Props) => (
  <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Content aria-describedby={undefined}>
      <Dialog.Header>
        <Dialog.Title>
          {/* pe-8 keeps the title clear of the absolutely positioned close button */}
          <span className="block pe-8">{title}</span>
        </Dialog.Title>
      </Dialog.Header>
      <div className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto overscroll-contain pe-1">
        {entries.map(entry => (
          <div
            key={entry.key}
            className={cnTw('flex items-center gap-4 rounded-xl bg-bg-surface-container p-3', icon ? 'h-16' : 'h-12')}
          >
            {icon ? (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-bg-action-secondary text-fg-primary">
                {icon}
              </div>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm leading-5 font-medium text-fg-primary">{entry.label}</span>
            </div>
            <PermissionStatusDropdown value={entry.status} onChange={status => onStatusChange(entry.key, status)} />
          </div>
        ))}
      </div>
    </Dialog.Content>
  </Dialog.Root>
);
