import { Button, Dialog } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { type ExecutableKind, useDisplayedProduct, usePinExecutable, usePinProduct } from '@/domains/product';
import { ProductDialogHeader } from '@/widgets/ProductDialogHeader';
import { runConfirmAction } from '../hooks/runConfirmAction';

type Props = {
  productId: string;
  // When present, confirm re-pins ONLY this modality (per-row update); otherwise
  // the whole product (the product-actions-menu "Update Version" flow).
  executableKind?: ExecutableKind;
  onClose: VoidFunction;
};

export const UpdateVersionDialog = ({ productId, executableKind, onClose }: Props) => {
  const { t } = useTranslation();
  const { data: product } = useDisplayedProduct(productId);
  const pinProduct = usePinProduct();
  const pinExecutable = usePinExecutable();

  const name = product?.displayName ?? productId;
  const pending = executableKind ? pinExecutable.pending : pinProduct.pending;

  const handleConfirm = () => {
    const action$ = executableKind
      ? pinExecutable.run({ identifier: productId, kind: executableKind })
      : pinProduct.run(productId);
    runConfirmAction(action$, {
      successTitle: t('feature.offlineAccess.toast.updated', { name }),
      errorTitle: t('feature.offlineAccess.toast.updateError'),
      onSuccess: onClose,
    });
  };

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
          <span className="text-2xl leading-8 font-semibold text-fg-primary">{t('feature.offlineAccess.menu.update')}</span>
          <span className="text-base leading-6 text-fg-secondary">{t('feature.offlineAccess.updateDescription')}</span>
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
                data-testid={TEST_IDS.offlineAccessUpdateConfirm}
                variant="primary"
                block
                disabled={pending}
                onClick={handleConfirm}
              >
                {t('feature.offlineAccess.updateDialog.confirm')}
              </Button>
            </div>
          </div>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
};
