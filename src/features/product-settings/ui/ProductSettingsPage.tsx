import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';

import Grid2x2Icon from '@/shared/assets/images/icons/grid-2x2.svg?jsx';
import Link2Icon from '@/shared/assets/images/icons/link-2.svg?jsx';
import PaintbrushIcon from '@/shared/assets/images/icons/paintbrush.svg?jsx';
import TrashIcon from '@/shared/assets/images/icons/trash.svg?jsx';
import { Button, Dialog, ListItem, SettingsList, SettingsSection, toast } from '@/shared/components';
import { Slot } from '@/shared/di';
import { useTranslation } from '@/shared/translation';
import { formatBytes } from '@/shared/utils';
import {
  type GrantedAccountAccess,
  type ProductPermissionEntry,
  permissionsService,
  productService,
  useDisplayedProduct,
  useOfflineCacheSize,
  useWatchGrantedAccountAccess,
  useWatchProductPermissions,
} from '@/domains/product';
import { onProductRefreshRequestedSideEffect } from '@/aggregates/product-loading';
import { productManagementUseCase, useForgetProduct } from '@/aggregates/product-management';
import { STATUS_LABEL_KEYS, getPermissionMeta } from '@/widgets/Permission';
import { ProductIcon } from '@/widgets/ProductIcon';
import { productSettingsSectionsSlot } from '../di';

type Props = {
  productId: string;
  onBack: VoidFunction;
};

export const ProductSettingsPage = ({ productId, onBack }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: product } = useDisplayedProduct(productId);
  const { forgetProduct } = useForgetProduct();
  const { data: permissionEntries } = useWatchProductPermissions(productId);
  const { data: accountAccess } = useWatchGrantedAccountAccess(productId);
  const cacheSize = useOfflineCacheSize(productId);
  const [forgetDialogOpen, setForgetDialogOpen] = useState(false);
  const [clearCacheDialogOpen, setClearCacheDialogOpen] = useState(false);

  const productName = product?.displayName ?? productId;

  // Forget operates on the raw route id, not the resolved product — a
  // permission-only entry may be unresolvable (offline, expired name,
  // localhost) yet its stored permission rows must still be purgeable.
  const handleForget = () => {
    forgetProduct(productId);
    setForgetDialogOpen(false);
    toast.success({ title: t('feature.productSettings.toast.appReset', { productName }) });
    onBack();
  };

  const handleClearCache = async () => {
    await productManagementUseCase.clearProductData(productId);

    for (const id of productService.refreshTargetIdentifiers(productId, product)) {
      void onProductRefreshRequestedSideEffect.apply({ identifier: id });
    }

    setClearCacheDialogOpen(false);
    toast.success({ title: t('feature.productSettings.toast.cacheCleared', { productName }) });
  };

  const requestedPermissions = buildRequestedPermissions(permissionEntries, accountAccess, t);

  return (
    <>
      <SettingsList title={productName} onBack={onBack}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <div className="size-16 shrink-0 overflow-hidden rounded-xl">
              <ProductIcon
                icon={product?.icon}
                className="size-full object-cover"
                fallback={
                  <div className="flex size-full items-center justify-center bg-bg-illustration-dark text-fg-primary-inverted">
                    <Grid2x2Icon className="size-6" />
                  </div>
                }
              />
            </div>

            {product?.description ? <p className="text-sm text-chrome-muted">{product.description}</p> : null}

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setClearCacheDialogOpen(true)}>
                <PaintbrushIcon className="size-4" />
                {t('feature.productSettings.clearCache')}
              </Button>
              <Button size="sm" onClick={() => setForgetDialogOpen(true)}>
                <TrashIcon className="size-4" />
                {t('feature.productSettings.forgetApp')}
              </Button>
              {cacheSize > 0 ? <span className="text-xs text-chrome-muted">{formatBytes(cacheSize)}</span> : null}
            </div>
          </div>

          <Slot id={productSettingsSectionsSlot} props={{ productId }} />

          <SettingsSection layout="list" title={t('feature.productSettings.requestedPermissions')}>
            {requestedPermissions.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-chrome-muted">{t('feature.productSettings.noPermissions')}</div>
            )}
            {requestedPermissions.map(({ id, label, icon: permIcon, statusText }) => (
              <ListItem
                key={id}
                icon={permIcon}
                label={label}
                description={statusText}
                chevron
                onClick={() =>
                  navigate({
                    to: '/settings/privacy/apps/$productId/$permissionId',
                    params: { productId, permissionId: id },
                  })
                }
              />
            ))}
          </SettingsSection>
        </div>
      </SettingsList>

      <ConfirmDialog
        confirmLabel={t('feature.productSettings.clearCache')}
        confirmVariant="primary"
        description={t('feature.productSettings.clearCacheDialog.description')}
        open={clearCacheDialogOpen}
        title={t('feature.productSettings.clearCacheDialog.title', { productName })}
        cancelLabel={t('common.action.cancel')}
        onConfirm={handleClearCache}
        onOpenChange={setClearCacheDialogOpen}
      />

      <ConfirmDialog
        confirmLabel={t('feature.productSettings.forgetApp')}
        confirmVariant="danger"
        description={t('feature.productSettings.forgetDialog.description', { productName })}
        open={forgetDialogOpen}
        title={t('feature.productSettings.forgetDialog.title', { productName })}
        cancelLabel={t('common.action.cancel')}
        onConfirm={handleForget}
        onOpenChange={setForgetDialogOpen}
      />
    </>
  );
};

const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmVariant,
  cancelLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant: 'primary' | 'danger';
  cancelLabel: string;
  onConfirm: VoidFunction;
}) => (
  <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Content>
      <Dialog.Header>
        <div className="w-full text-start">
          <Dialog.Title>
            <span className="mb-3 block text-fg-primary">{title}</span>
          </Dialog.Title>
          <Dialog.Description>
            <span className="block text-base font-normal text-fg-primary">{description}</span>
          </Dialog.Description>
        </div>
      </Dialog.Header>
      <Dialog.Footer>
        <div className="flex w-full gap-2">
          <div className="flex-1">
            <Dialog.Close asChild>
              <Button horizontalSize="fill">{cancelLabel}</Button>
            </Dialog.Close>
          </div>
          <div className="flex-1">
            <Button variant={confirmVariant} horizontalSize="fill" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
);

type RequestedPermission = {
  id: string;
  label: string;
  icon: ReactNode;
  statusText: string;
};

function buildRequestedPermissions(
  permissionEntries: ProductPermissionEntry[],
  accountAccess: GrantedAccountAccess[],
  t: (id: string, values?: Record<string, string | number>) => string,
): RequestedPermission[] {
  // Only rows the user has actually answered: a slot exists exactly when a decision
  // does, so an untouched permission is not a "requested" one.
  const result: RequestedPermission[] = permissionEntries.flatMap(entry => {
    if (entry.status === 'ask') return [];
    const meta = getPermissionMeta(entry.permissionId);
    if (!meta) return [];

    return [
      {
        id: meta.id,
        label: t(meta.labelKey),
        icon: meta.icon,
        statusText: t(STATUS_LABEL_KEYS[entry.status]),
      },
    ];
  });

  if (accountAccess.length > 0) {
    const aliasStatus = permissionsService.rollupPermissionStatus(accountAccess.map(entry => entry.status));
    result.push({
      id: 'Alias',
      label: t('feature.productSettings.aliasPermission.label'),
      icon: <Link2Icon />,
      statusText: t(STATUS_LABEL_KEYS[aliasStatus]),
    });
  }

  return result;
}
