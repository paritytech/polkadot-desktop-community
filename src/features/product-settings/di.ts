import { createSlot } from '@/shared/di';

export type ProductSettingsSectionProps = {
  productId: string;
};

export const productSettingsSectionsSlot = createSlot<ProductSettingsSectionProps>({
  name: 'productSettingsSectionsSlot',
});
