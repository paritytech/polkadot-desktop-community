import { Dialog } from '@novasamatech/tr-ui';

import { Button } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { useDisplayedProduct, usePinProduct } from '@/domains/product';
import { ProductDialogHeader } from '@/widgets/ProductDialogHeader';
import { runConfirmAction } from '../hooks/runConfirmAction';

type Props = {
  productId: string;
  onClose: VoidFunction;
};

export const EnableOfflineDialog = ({ productId, onClose }: Props) => {
  const { t } = useTranslation();
  const { data: product } = useDisplayedProduct(productId);
  const { run, pending } = usePinProduct();

  const name = product?.displayName ?? productId;

  const handleConfirm = () =>
    runConfirmAction(run(productId), {
      successTitle: t('feature.offlineAccess.toast.enabled', { name }),
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
        <ProductDialogHeader product={product} />
        <div className="flex flex-col gap-2">
          <span className="text-2xl leading-8 font-semibold text-fg-primary">
            {t('feature.offlineAccess.enableDialog.title')}
          </span>
          <span className="text-base leading-6 text-fg-secondary">{t('feature.offlineAccess.enableDialog.description')}</span>
        </div>
        <Dialog.Footer>
          <div className="flex w-full gap-2">
            <div className="flex-1">
              <Button data-testid={TEST_IDS.offlineAccessDialogCancel} block onClick={onClose}>
                {t('common.cancel')}
              </Button>
            </div>
            <div className="flex-1">
              <Button
                data-testid={TEST_IDS.offlineAccessEnableConfirm}
                variant="primary"
                block
                disabled={pending}
                onClick={handleConfirm}
              >
                {t('feature.offlineAccess.enableDialog.confirm')}
              </Button>
            </div>
          </div>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
};
