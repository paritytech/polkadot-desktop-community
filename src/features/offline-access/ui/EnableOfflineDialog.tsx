import { Button, Dialog } from '@/shared/components';
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
    <Dialog.Root
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <Dialog.Content aria-describedby={undefined}>
        <ProductDialogHeader product={product} />
        <div className="flex flex-col gap-2">
          <span className="text-lg font-semibold text-fg-primary">{t('feature.offlineAccess.enableDialog.title')}</span>
          <span className="text-base text-fg-secondary">{t('feature.offlineAccess.enableDialog.description')}</span>
        </div>
        <Dialog.Footer>
          <div className="flex w-full gap-2">
            <div className="flex-1">
              <Button data-testid={TEST_IDS.offlineAccessDialogCancel} horizontalSize="fill" onClick={onClose}>
                {t('common.cancel')}
              </Button>
            </div>
            <div className="flex-1">
              <Button
                data-testid={TEST_IDS.offlineAccessEnableConfirm}
                variant="primary"
                horizontalSize="fill"
                disabled={pending}
                onClick={handleConfirm}
              >
                {t('feature.offlineAccess.enableDialog.confirm')}
              </Button>
            </div>
          </div>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
};
