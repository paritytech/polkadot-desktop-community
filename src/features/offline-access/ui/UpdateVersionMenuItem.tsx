import { RefreshCw } from 'lucide-react';

import { useTranslation } from '@/shared/translation';
import { MenuItem } from '@/features/product-actions-menu';
import { useNewerVersionAvailable } from '../hooks/useNewerVersionAvailable';
import { openOfflineAccessDialog } from '../state/dialogState';

type Props = {
  productId: string;
  closeMenu: VoidFunction;
};

export const UpdateVersionMenuItem = ({ productId, closeMenu }: Props) => {
  const { t } = useTranslation();
  const newer = useNewerVersionAvailable(productId);
  if (!newer) return null;

  return (
    <MenuItem
      icon={<RefreshCw className="size-4" aria-hidden />}
      label={t('feature.offlineAccess.menu.update')}
      onSelect={() => {
        openOfflineAccessDialog({ kind: 'update', productId });
        closeMenu();
      }}
    />
  );
};
