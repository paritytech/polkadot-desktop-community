import { Button, Dialog, ScrollArea, toastSuccess } from '@novasamatech/tr-ui';
import { useNavigate } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, Grid2X2, Link2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { Slot } from '@/shared/di';
import { useTranslation } from '@/shared/translation';
import {
  type AliasPermission,
  type PermissionStatus,
  type ProductPermissions,
  lifecycleUseCase,
  permissionsService,
  productService,
  useAllAliasPermissions,
  useDisplayedProduct,
  useProductPermissions,
} from '@/domains/product';
import { onProductRefreshRequestedSideEffect } from '@/aggregates/product-loading';
import { useForgetProduct } from '@/aggregates/product-management';
import { STATUS_LABEL_KEYS, getPermissionMeta } from '@/widgets/Permission';
import { ProductIcon } from '@/widgets/ProductIcon';
import { productSettingsSectionsSlot } from '../di';

type Props = {
  productId: string;
  backLabel: string;
  onBack: VoidFunction;
};

export const ProductSettingsPage = ({ productId, backLabel, onBack }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: product } = useDisplayedProduct(productId);
  const { forgetProduct } = useForgetProduct();
  const { data: permissions } = useProductPermissions(productId);
  const { data: allAliasPermissions } = useAllAliasPermissions();
  const [forgetDialogOpen, setForgetDialogOpen] = useState(false);
  const [clearCacheDialogOpen, setClearCacheDialogOpen] = useState(false);

  const productName = product?.displayName ?? productId;

  // Forget operates on the raw route id, not the resolved product — a
  // permission-only entry may be unresolvable (offline, expired name,
  // localhost) yet its stored permission rows must still be purgeable.
  const handleForget = () => {
    forgetProduct(productId);
    setForgetDialogOpen(false);
    toastSuccess({ title: t('feature.productSettings.toast.appReset', { productName }) });
    onBack();
  };

  const handleClearCache = async () => {
    await lifecycleUseCase.clearProductCache(productId);

    for (const id of productService.refreshTargetIdentifiers(productId, product)) {
      void onProductRefreshRequestedSideEffect.apply({ identifier: id });
    }

    setClearCacheDialogOpen(false);
    toastSuccess({ title: t('feature.productSettings.toast.cacheCleared', { productName }) });
  };

  const requestedPermissions = buildRequestedPermissions(productId, permissions, allAliasPermissions, t);

  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <ScrollArea>
        <div className="flex min-h-0 flex-col items-center">
          <div className="flex min-h-0 w-150 max-w-full flex-col gap-6 px-2 py-3">
            <button
              className="flex items-center gap-2 self-start text-sm leading-5 font-semibold text-fg-primary"
              onClick={onBack}
            >
              <ChevronLeft size={20} />
              {backLabel}
            </button>

            <div className="flex flex-col gap-4">
              <div className="size-16 shrink-0 overflow-hidden rounded-xl">
                <ProductIcon
                  icon={product?.icon}
                  className="size-full object-cover"
                  fallback={
                    <div className="flex size-full items-center justify-center bg-bg-illustration-dark text-fg-primary-inverted">
                      <Grid2X2 size={24} />
                    </div>
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-2xl leading-8 font-semibold text-fg-primary">{productName}</p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setClearCacheDialogOpen(true)}>
                  {t('feature.productSettings.clearCache')}
                </Button>
                <Button variant="outline" onClick={() => setForgetDialogOpen(true)}>
                  {t('feature.productSettings.forgetApp')}
                </Button>
              </div>
            </div>

            <div className="flex flex-col">
              <div className="py-2 text-base leading-6 font-semibold text-fg-primary">
                {t('feature.productSettings.requestedPermissions')}
              </div>
              <div className="flex flex-col">
                {requestedPermissions.length === 0 && (
                  <div className="py-4 text-center text-sm text-fg-tertiary">{t('feature.productSettings.noPermissions')}</div>
                )}
                {requestedPermissions.map(({ id, label, icon: permIcon, statusText }) => (
                  <button
                    key={id}
                    className="flex w-full items-center gap-4 rounded-xl p-3 text-left transition-colors hover:bg-bg-selection-container-hover"
                    onClick={() =>
                      navigate({
                        to: '/settings/privacy/apps/$productId/$permissionId',
                        params: { productId, permissionId: id },
                      })
                    }
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-bg-illustration-light text-primary">
                        {permIcon}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col items-start">
                        <span className="truncate text-sm font-medium text-fg-primary">{label}</span>
                        <span className="truncate text-xs text-fg-tertiary">{statusText}</span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-fg-tertiary" />
                  </button>
                ))}
              </div>
            </div>

            <Slot id={productSettingsSectionsSlot} props={{ productId }} />
          </div>
        </div>
      </ScrollArea>

      <ConfirmDialog
        confirmLabel={t('feature.productSettings.clearCache')}
        confirmVariant="default"
        description={t('feature.productSettings.clearCacheDialog.description')}
        open={clearCacheDialogOpen}
        title={t('feature.productSettings.clearCacheDialog.title', { productName })}
        cancelLabel={t('common.action.cancel')}
        onConfirm={handleClearCache}
        onOpenChange={setClearCacheDialogOpen}
      />

      <ConfirmDialog
        confirmLabel={t('feature.productSettings.forgetApp')}
        confirmVariant="destructive"
        description={t('feature.productSettings.forgetDialog.description', { productName })}
        open={forgetDialogOpen}
        title={t('feature.productSettings.forgetDialog.title', { productName })}
        cancelLabel={t('common.action.cancel')}
        onConfirm={handleForget}
        onOpenChange={setForgetDialogOpen}
      />
    </div>
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
  confirmVariant: 'default' | 'destructive';
  cancelLabel: string;
  onConfirm: VoidFunction;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <Dialog.Content showCloseButton>
      <Dialog.Header>
        <div className="w-full text-left">
          <Dialog.Title>
            <span className="mb-3 block text-2xl leading-8 font-semibold text-fg-primary">{title}</span>
          </Dialog.Title>
          <Dialog.Description>
            <span className="block text-base leading-6 font-normal text-fg-primary">{description}</span>
          </Dialog.Description>
        </div>
      </Dialog.Header>
      <Dialog.Footer>
        <div className="flex w-full gap-2">
          <div className="flex-1">
            <Dialog.Close asChild>
              <Button variant="outline" fullWidth>
                {cancelLabel}
              </Button>
            </Dialog.Close>
          </div>
          <div className="flex-1">
            <Button variant={confirmVariant} fullWidth onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog>
);

type RequestedPermission = {
  id: string;
  label: string;
  icon: ReactNode;
  statusText: string;
};

function buildRequestedPermissions(
  productId: string,
  permissions: ProductPermissions | null,
  aliasPermissions: AliasPermission[],
  t: (id: string, values?: Record<string, string | number>) => string,
): RequestedPermission[] {
  const statusesById = new Map<
    string,
    { meta: NonNullable<ReturnType<typeof getPermissionMeta>>; statuses: PermissionStatus[] }
  >();

  const collect = (metaId: string | undefined, status: PermissionStatus) => {
    const meta = metaId ? getPermissionMeta(metaId) : undefined;
    if (!meta) return;
    const existing = statusesById.get(meta.id);
    if (existing) {
      existing.statuses.push(status);
    } else {
      statusesById.set(meta.id, { meta, statuses: [status] });
    }
  };

  if (permissions) {
    for (const dp of permissions.devicePermissions) {
      collect(permissionsService.getSettingsPermissionId(dp.payload.name), dp.status);
    }
    for (const rp of permissions.remotePermissions) {
      collect(permissionsService.resolvePermissionMetaId(rp.payload.type), rp.status);
    }
  }

  const result: RequestedPermission[] = [...statusesById.values()].map(({ meta, statuses }) => ({
    id: meta.id,
    label: t(meta.labelKey),
    icon: meta.icon,
    statusText: t(STATUS_LABEL_KEYS[permissionsService.rollupPermissionStatus(statuses)]),
  }));

  const aliasEntries = aliasPermissions.filter(entry => entry.requesterProductId === productId);
  if (aliasEntries.length > 0) {
    const hasGranted = aliasEntries.some(entry => entry.status === 'granted');
    result.push({
      id: 'Alias',
      label: t('feature.productSettings.aliasPermission.label'),
      icon: <Link2 size={20} />,
      statusText: t(STATUS_LABEL_KEYS[hasGranted ? 'granted' : 'denied']),
    });
  }

  return result;
}
