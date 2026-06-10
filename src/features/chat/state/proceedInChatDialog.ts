import { createDialogTarget } from '@/shared/rxstate';

const dialog = createDialogTarget<string>();

export const proceedInChatDialogTarget = dialog.target;
export const openProceedInChatDialog = dialog.open;
export const closeProceedInChatDialog = dialog.close;
