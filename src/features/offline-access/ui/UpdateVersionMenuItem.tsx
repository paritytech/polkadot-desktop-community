import ArrowDownToLineIcon from '@/shared/assets/images/icons/arrow-down-to-line.svg?jsx';
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
      icon={<ArrowDownToLineIcon className="size-4" />}
      label={t('feature.offlineAccess.menu.update')}
      onSelect={() => {
        openOfflineAccessDialog({ kind: 'update', productId });
        closeMenu();
      }}
    />
  );
};
