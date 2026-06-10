import { LayoutDashboard } from 'lucide-react';

import { useTranslation } from '@/shared/translation';
import { MenuItem } from '@/features/product-actions-menu';
import { openAddToDashboardDialog } from '../state/addToDashboardDialog';

type Props = {
  productId: string;
  closeMenu: VoidFunction;
};

export const AddToDashboardMenuItem = ({ productId, closeMenu }: Props) => {
  const { t } = useTranslation();

  return (
    <MenuItem
      icon={<LayoutDashboard className="size-4" aria-hidden />}
      label={t('feature.dashboard.addToDashboard')}
      onSelect={() => {
        closeMenu();
        openAddToDashboardDialog(productId);
      }}
    />
  );
};
