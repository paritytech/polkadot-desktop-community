import { useRxState } from '@/shared/rxstate';
import { closeOfflineAccessDialog, offlineAccessDialogTarget } from '../state/dialogState';

import { EnableOfflineDialog } from './EnableOfflineDialog';
import { RemoveOfflineDialog } from './RemoveOfflineDialog';
import { UpdateVersionDialog } from './UpdateVersionDialog';

export const OfflineAccessDialogHost = () => {
  const [target] = useRxState(offlineAccessDialogTarget);
  if (!target) return null;
  switch (target.kind) {
    case 'enable':
      return <EnableOfflineDialog productId={target.productId} onClose={closeOfflineAccessDialog} />;
    case 'remove':
      return <RemoveOfflineDialog productId={target.productId} onClose={closeOfflineAccessDialog} />;
    case 'update':
      return <UpdateVersionDialog productId={target.productId} onClose={closeOfflineAccessDialog} />;
  }
};
