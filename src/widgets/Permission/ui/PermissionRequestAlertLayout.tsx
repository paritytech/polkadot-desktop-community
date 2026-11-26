import { type AnimationEvent, type ReactNode } from 'react';

import { Dialog } from '@/shared/components';
import { useTranslation } from '@/shared/translation';
import { useDisplayedProduct } from '@/domains/product';
import { ProductHeader, useProductHeaderProps } from '@/widgets/ProductHeader';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  title: string;
  description: string;
  externalRequestUrls?: string[] | null;
  footer: ReactNode;
  /** Fires once the exit animation finishes — useful for chained modal queues. */
  onExited?: VoidFunction;
};

export const PermissionRequestAlertLayout = ({
  open,
  onOpenChange,
  productId,
  title,
  description,
  externalRequestUrls,
  footer,
  onExited,
}: Props) => {
  const { t } = useTranslation();
  const { data: product } = useDisplayedProduct(productId);
  const header = useProductHeaderProps({ product, fallbackName: productId, fallbackDomain: productId });

  const urlLines = externalRequestUrls?.map(x => x.trim()) ?? [];
  const showDomainsBlock = urlLines.length > 0;

  const handleAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.currentTarget.getAttribute('data-state') !== 'closed') return;
    onExited?.();
  };

  const handleInteractOutside = (event: { preventDefault: () => void }) => {
    event.preventDefault();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        aria-describedby={undefined}
        showCloseButton={false}
        onAnimationEnd={handleAnimationEnd}
        onOpenAutoFocus={event => event.preventDefault()}
        onInteractOutside={handleInteractOutside}
      >
        <ProductHeader {...header} />

        <div className="flex flex-col gap-2 py-3">
          <Dialog.Title>
            <span className="text-fg-primary">{title}</span>
          </Dialog.Title>
          <Dialog.Description>
            <span className="text-base font-normal text-fg-primary">{description}</span>
          </Dialog.Description>
        </div>

        {showDomainsBlock ? (
          <div className="mb-8 flex w-full flex-col gap-2">
            <p className="text-xs font-normal text-fg-secondary">
              {t('feature.productPermissions.permissionRequest.domainsLabel')}
            </p>
            <div className="flex min-h-9 w-full flex-col rounded-lg border border-stroke-primary bg-bg-surface-nested p-3">
              {urlLines.map((line, index) => (
                <p key={index} className="mb-0 text-sm font-normal break-all text-fg-primary">
                  {line}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex w-full min-w-0 gap-2">{footer}</div>
      </Dialog.Content>
    </Dialog.Root>
  );
};
