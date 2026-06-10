import { Button, Dialog } from '@novasamatech/tr-ui';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { usePersistedProductById, useUnpinProduct } from '@/domains/product';
import { ProductDialogHeader } from '@/widgets/ProductDialogHeader';
import { runConfirmAction } from '../hooks/runConfirmAction';

type Props = {
  productId: string;
  onClose: VoidFunction;
};

export const RemoveOfflineDialog = ({ productId, onClose }: Props) => {
  const { t } = useTranslation();
  const { data: record } = usePersistedProductById(productId);
  const { run, pending } = useUnpinProduct();

  const name = record?.displayName ?? productId;

  const handleConfirm = () =>
    runConfirmAction(run(productId), {
      successTitle: t('feature.offlineAccess.toast.removed', { name }),
      errorTitle: t('feature.offlineAccess.toast.error'),
      onSuccess: onClose,
    });

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <Dialog.Content aria-describedby={undefined} variant="default">
        <ProductDialogHeader product={record} />
        <div className="flex flex-col gap-2 py-6">
          <span className="text-sm text-fg-secondary">{t('feature.offlineAccess.removeDescription')}</span>
        </div>
        <Dialog.Footer>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            data-testid={TEST_IDS.offlineAccessRemoveConfirm}
            variant="destructive"
            disabled={pending}
            onClick={handleConfirm}
          >
            {t('feature.offlineAccess.removeConfirm')}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
};
