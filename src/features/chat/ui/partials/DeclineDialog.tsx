import { Button, Dialog } from '@novasamatech/tr-ui';

type DeclineDialogProps = {
  isOpen: boolean;
  peerName: string;
  onClose: VoidFunction;
  onDecline: VoidFunction;
};

export const DeclineDialog = ({ isOpen, peerName, onClose, onDecline }: DeclineDialogProps) => {
  return (
    <Dialog modal open={isOpen} onOpenChange={open => !open && onClose()}>
      <Dialog.Content>
        <div className="flex flex-col gap-4 p-8">
          {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
          <h3 className="text-xl leading-7 font-semibold text-fg-primary">Decline Message Request?</h3>
          {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
          <p className="text-sm leading-[18px] text-fg-secondary">Message request from {peerName}</p>
          <div className="flex items-center justify-end gap-2">
            {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
            <Button onClick={onDecline}>Decline</Button>
          </div>
        </div>
      </Dialog.Content>
    </Dialog>
  );
};
