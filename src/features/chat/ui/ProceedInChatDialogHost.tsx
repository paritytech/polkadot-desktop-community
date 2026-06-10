import { useRxState } from '@/shared/rxstate';
import { closeProceedInChatDialog, proceedInChatDialogTarget } from '../state/proceedInChatDialog';

import { ProceedInChatDialog } from './ProceedInChatDialog';

export const ProceedInChatDialogHost = () => {
  const [productId] = useRxState(proceedInChatDialogTarget);
  return (
    <ProceedInChatDialog
      productId={productId ?? ''}
      open={!!productId}
      onOpenChange={open => {
        if (!open) closeProceedInChatDialog();
      }}
    />
  );
};
