import { createSlot } from '@/shared/di';

export type ProductActionsMenuItemProps = {
  productId: string;
  closeMenu: VoidFunction;
};

export const productActionsMenuItemsSlot = createSlot<ProductActionsMenuItemProps>({
  name: 'productActionsMenuItemsSlot',
});
