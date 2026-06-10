import { Button, Dialog } from '@novasamatech/tr-ui';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { useDisplayedProduct, usePinProduct } from '@/domains/product';
import { ProductDialogHeader } from '@/widgets/ProductDialogHeader';
import { runConfirmAction } from '../hooks/runConfirmAction';

type Props = {
  productId: string;
  onClose: VoidFunction;
};

export const UpdateVersionDialog = ({ productId, onClose }: Props) => {
  const { t } = useTranslation();
  const { data: product } = useDisplayedProduct(productId);
  const { run, pending } = usePinProduct();

  const name = product?.displayName ?? productId;

  const handleConfirm = () =>
    runConfirmAction(run(productId), {
      successTitle: t('feature.offlineAccess.toast.updated', { name }),
      errorTitle: t('feature.offlineAccess.toast.updateError'),
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
        <ProductDialogHeader product={product} />
        <div className="flex flex-col gap-2 py-6">
          <span className="text-sm text-fg-secondary">{t('feature.offlineAccess.updateDescription')}</span>
        </div>
        <Dialog.Footer>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button data-testid={TEST_IDS.offlineAccessUpdateConfirm} variant="default" disabled={pending} onClick={handleConfirm}>
            {t('feature.offlineAccess.updateConfirm')}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
};
