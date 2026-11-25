import { Button, Dialog } from '@novasamatech/tr-ui';

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
    <Dialog modal open={isOpen} onOpenChange={open => !open && onClose()}>
      <Dialog.Content>
        <div data-testid={testId} className="flex flex-col gap-4 p-8">
          <h3 className="text-xl leading-7 font-semibold text-fg-primary">{title}</h3>
          <p className="text-sm leading-4.5 text-fg-secondary">{description}</p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              {cancelLabel}
            </Button>
            <Button data-testid={confirmTestId} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Dialog.Content>
    </Dialog>
  );
};
