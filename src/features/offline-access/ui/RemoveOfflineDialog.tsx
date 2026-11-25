import { Button, Dialog } from '@/shared/components';
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
    <Dialog.Root
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <Dialog.Content aria-describedby={undefined}>
        <ProductDialogHeader product={record} />
        <div className="flex flex-col gap-2">
          <span className="text-2xl leading-8 font-semibold text-fg-primary">
            {t('feature.offlineAccess.removeDialog.title')}
          </span>
          <span className="text-base leading-6 text-fg-secondary">
            {t('feature.offlineAccess.removeDialog.description', { name })}
          </span>
        </div>
        <Dialog.Footer>
          <div className="flex w-full gap-2">
            <div className="flex-1">
              <Button block onClick={onClose}>
                {t('common.cancel')}
              </Button>
            </div>
            <div className="flex-1">
              <Button
                data-testid={TEST_IDS.offlineAccessRemoveConfirm}
                variant="danger"
                block
                disabled={pending}
                onClick={handleConfirm}
              >
                {t('feature.offlineAccess.removeDialog.confirm')}
              </Button>
            </div>
          </div>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
};
