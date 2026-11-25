import { type PropsWithChildren } from 'react';

import { Dialog } from '@/shared/components';

type AddToDashboardDialogShellProps = PropsWithChildren<{
  isOpen: boolean;
  onClose: () => void;
}>;

// Shared Dialog shell for the Add-to-Dashboard modal panels (native + product).
// Both variants wrap their panel in a byte-identical Dialog; this is the single
// source for that shell so the markup stays in one place.
export const AddToDashboardDialogShell = ({ isOpen, onClose, children }: AddToDashboardDialogShellProps) => {
  return (
    <Dialog.Root
      modal
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <Dialog.Content width="lg" aria-describedby={undefined} onOpenAutoFocus={event => event.preventDefault()}>
        <div className="flex h-170">{children}</div>
      </Dialog.Content>
    </Dialog.Root>
  );
};
