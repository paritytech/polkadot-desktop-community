import { createDialogTarget } from '@/shared/rxstate';

type DialogKind = 'enable' | 'remove' | 'update';
type DialogState = { kind: DialogKind; productId: string };

const dialog = createDialogTarget<DialogState>();

export const offlineAccessDialogTarget = dialog.target;
export const openOfflineAccessDialog = dialog.open;
export const closeOfflineAccessDialog = dialog.close;
