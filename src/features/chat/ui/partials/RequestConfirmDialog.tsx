import { Button, Dialog } from '@/shared/components';

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
  return (
    <Dialog.Root modal open={isOpen} onOpenChange={open => !open && onClose()}>
      <Dialog.Content>
        <div data-testid={testId} className="flex flex-col gap-4 p-8">
          <Dialog.Title>
            <span className="text-fg-primary">{title}</span>
          </Dialog.Title>
          <p className="text-sm text-fg-secondary">{description}</p>
          <div className="flex items-center justify-end gap-2">
            <Button onClick={onClose}>{cancelLabel}</Button>
            <Button variant="primary" data-testid={confirmTestId} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
};
