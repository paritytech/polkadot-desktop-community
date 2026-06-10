import { Dialog, ScrollArea } from '@novasamatech/tr-ui';
import { type ReactNode } from 'react';

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
  icon: ReactNode;
  entries: PermissionEntry[];
  onOpenChange: (open: boolean) => void;
  onStatusChange: (key: string, status: PermissionStatus) => void;
};

// Shared shell for the per-product access dialogs (alias contexts, web domains):
// a titled dialog listing entries, each with an icon, label, and status dropdown.
export const PermissionEntriesDialog = ({ open, title, icon, entries, onOpenChange, onStatusChange }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <Dialog.Content showCloseButton size="md" aria-describedby={undefined}>
      <Dialog.Header>
        <Dialog.Title>
          {/* pr-8 keeps the title clear of the absolutely positioned close button;
              break-words restores whole-word wrapping over the dialog's break-all */}
          <span className="block pr-8 break-words">{title}</span>
        </Dialog.Title>
      </Dialog.Header>
      <ScrollArea>
        <div className="flex max-h-[60vh] flex-col gap-1 pr-1">
          {entries.map(entry => (
            <div key={entry.key} className="flex h-16 items-center gap-4 rounded-xl bg-bg-surface-container p-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-bg-action-secondary text-fg-primary">
                {icon}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm leading-5 font-medium text-fg-primary">{entry.label}</span>
              </div>
              <PermissionStatusDropdown value={entry.status} onChange={status => onStatusChange(entry.key, status)} />
            </div>
          ))}
        </div>
      </ScrollArea>
    </Dialog.Content>
  </Dialog>
);
