import { type MouseEvent } from 'react';

import { AlertDialog } from '@/shared/components';

type RequestConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  testId: string;
  confirmTestId: string;
  onClose: VoidFunction;
  onConfirm: VoidFunction;
};

export const RequestConfirmDialog = ({
  isOpen,
  title,
  description,
  cancelLabel,
  confirmLabel,
  testId,
  confirmTestId,
  onClose,
  onConfirm,
}: RequestConfirmDialogProps) => {
  // Radix closes an alert dialog on its Action; the callers close it themselves once the request settles.
  const handleConfirm = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    onConfirm();
  };

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={open => !open && onClose()}>
      <AlertDialog.Content data-testid={testId}>
        <AlertDialog.Header>
          <AlertDialog.Title>{title}</AlertDialog.Title>
          <AlertDialog.Description>{description}</AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>{cancelLabel}</AlertDialog.Cancel>
          <AlertDialog.Action variant="primary" data-testid={confirmTestId} onClick={handleConfirm}>
            {confirmLabel}
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
};
