import { createDialogTarget } from '@/shared/rxstate';

const dialog = createDialogTarget<string>();

export const addToDashboardDialogTarget = dialog.target;
export const openAddToDashboardDialog = dialog.open;
export const closeAddToDashboardDialog = dialog.close;
