import { Button, Dialog } from '@novasamatech/tr-ui';
import { memo } from 'react';

import { useTranslation } from '@/shared/translation';
import { type Product } from '@/domains/product';
import { ProductDialogHeader } from '@/widgets/ProductDialogHeader';

export type PreimageSubmitRequest = {
  dataSize: number;
};

type Props = {
  product: Nullable<Product>;
  request: PreimageSubmitRequest;
  onAllow: VoidFunction;
  onDeny: VoidFunction;
};

export const PreimageSubmitModal = memo(({ product, request, onAllow, onDeny }: Props) => {
  const { t } = useTranslation();

  const sizeText = request.dataSize < 1024 ? `${request.dataSize} B` : `${(request.dataSize / 1024).toFixed(1)} KB`;
  const handleInteractOutside = (event: { preventDefault: () => void }) => {
    event.preventDefault();
  };

  return (
    <Dialog modal open onOpenChange={open => !open && onDeny()}>
      <Dialog.Content
        aria-describedby={undefined}
        variant="default"
        showCloseButton={false}
        onInteractOutside={handleInteractOutside}
        onOpenAutoFocus={event => event.preventDefault()}
      >
        <ProductDialogHeader product={product} />

        <div className="flex flex-col gap-2 py-3">
          <Dialog.Title>
            <span className="text-2xl leading-8 font-semibold text-fg-primary">{t('feature.browser.storeDataRequest')}</span>
          </Dialog.Title>
          <Dialog.Description>
            <span className="text-base leading-6 font-normal text-fg-primary">
              {t('feature.browser.storeDataDescription', { size: sizeText })}
            </span>
          </Dialog.Description>
        </div>

        <div className="flex w-full min-w-0 gap-2">
          <div className="min-w-0 flex-1">
            <Button type="button" variant="outline" fullWidth onClick={onDeny}>
              {t('feature.browser.storeDataDeny')}
            </Button>
          </div>
          <div className="min-w-0 flex-1">
            <Button type="button" variant="default" fullWidth onClick={onAllow}>
              {t('common.action.allow')}
            </Button>
          </div>
        </div>
      </Dialog.Content>
    </Dialog>
  );
});
