import ImportIcon from '@/shared/assets/images/icons/import.svg?jsx';
import MonitorDownOffIcon from '@/shared/assets/images/icons/monitor-down-off.svg?jsx';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { useIsPinned } from '@/domains/product';
import { MenuItem } from '@/features/product-actions-menu';
import { openOfflineAccessDialog } from '../state/dialogState';

type Props = {
  productId: string;
  closeMenu: VoidFunction;
};

export const OfflineAccessMenuItem = ({ productId, closeMenu }: Props) => {
  const { t } = useTranslation();
  const pinned = useIsPinned(productId);

  return (
    <MenuItem
      testId={TEST_IDS.offlineAccessMenuItem}
      icon={pinned ? <MonitorDownOffIcon className="size-4" /> : <ImportIcon className="size-4" />}
      label={pinned ? t('feature.offlineAccess.menu.remove') : t('feature.offlineAccess.menu.enable')}
      onSelect={() => {
        openOfflineAccessDialog({ kind: pinned ? 'remove' : 'enable', productId });
        closeMenu();
      }}
    />
  );
};
