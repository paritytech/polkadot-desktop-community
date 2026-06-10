import { Button, ScrollArea } from '@novasamatech/tr-ui';
import { ChevronLeft, ChevronRight, Grid2X2, Link2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { useDisplayedProduct } from '@/domains/product';
import {
  type AliasPermission,
  type PermissionModality,
  type PermissionStatus,
  permissionsService,
  useAllAliasPermissions,
  useProductPermissions,
  useRemoveAliasPermission,
  useResetPermissionToDefault,
  useSetAliasPermission,
  useSetDevicePermission,
  useSetRemotePermission,
  useSetRemotePermissionsBatch,
} from '@/domains/product';
import { PermissionStatusDropdown, getModalityMeta, getPermissionMeta } from '@/widgets/Permission';
import { ProductIcon } from '@/widgets/ProductIcon';

import { AliasContextsAccessDialog } from './AliasContextsAccessDialog';
import { WebDomainsAccessDialog } from './WebDomainsAccessDialog';

type Props = {
  productId: string;
  permissionId: string;
  backLabel: string;
  onBack: VoidFunction;
};

export const AppPermissionEntityPage = ({ productId, permissionId, backLabel, onBack }: Props) => {
  const { t } = useTranslation();
  const { data: product } = useDisplayedProduct(productId);
  const isAliasPermission = permissionId === 'Alias';
  const meta = getPermissionMeta(permissionId);
  const { data: allAliasPermissions } = useAllAliasPermissions();
  const { data: permissions } = useProductPermissions(productId);
  const setAliasPermission = useSetAliasPermission();
  const removeAliasPermission = useRemoveAliasPermission();
  const setDevice = useSetDevicePermission();
  const setRemote = useSetRemotePermission();
  const setRemoteBatch = useSetRemotePermissionsBatch();
  const resetPermission = useResetPermissionToDefault();
  const [webDomainsModality, setWebDomainsModality] = useState<PermissionModality | null>(null);
  const [aliasContextsDialogOpen, setAliasContextsDialogOpen] = useState(false);

  if (!meta && !isAliasPermission) return null;

  const permissionLabel = isAliasPermission ? t('feature.productSettings.aliasPermission.label') : t(meta?.labelKey ?? '');
  const productName = product?.displayName ?? productId;
  const aliasPermissions = allAliasPermissions.filter(entry => entry.requesterProductId === productId);
  const hasAliasContexts = aliasPermissions.length > 0;
  const modalities = permissionsService.permissionModalitiesForProduct(product?.executables ?? null, permissions);
  const headerIcon = isAliasPermission ? <Link2 size={20} /> : meta?.icon;

  const setAliasStatus = (newStatus: PermissionStatus, targetPermissions: AliasPermission[]) => {
    for (const aliasPermission of targetPermissions) {
      if (newStatus === 'ask') {
        removeAliasPermission.run({
          requesterProductId: aliasPermission.requesterProductId,
          requestedContextId: aliasPermission.requestedContextId,
        });
        continue;
      }

      setAliasPermission.run({
        requesterProductId: aliasPermission.requesterProductId,
        requestedContextId: aliasPermission.requestedContextId,
        status: newStatus,
      });
    }
  };

  const handleStatusChange = (modality: PermissionModality, newStatus: PermissionStatus) => {
    if (!meta) return;

    if (permissionsService.isStoredAsDevicePermission(meta.id)) {
      const deviceName = permissionsService.getDevicePermissionName(meta.id);
      if (!deviceName) return;

      setDevice.run({
        productId,
        permission: { payload: { name: deviceName }, modality, status: newStatus },
      });
      return;
    }

    if (permissionsService.isStoredRemotePermissionType(meta.id)) {
      setRemote.run({ productId, permission: { payload: { type: meta.id }, modality, status: newStatus } });
      return;
    }

    if (meta.id === 'ExternalRequest') {
      setRemoteBatch.run({
        productId,
        permissions: permissionsService
          .getExternalRequestPermissions(permissions, modality)
          .map(entry => ({ payload: { type: 'Remote', pattern: entry.payload.pattern }, modality, status: newStatus })),
      });
    }
  };

  const handleResetToDefault = () => {
    if (isAliasPermission) {
      setAliasStatus('ask', aliasPermissions);
      return;
    }
    if (!meta) return;
    resetPermission.run({ productId, permissionId: meta.id });
  };

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
              <div className="relative size-16">
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
                <div className="absolute -right-1 -bottom-1 flex size-10 items-center justify-center rounded-xl bg-bg-surface-container text-fg-primary">
                  {headerIcon}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-2xl leading-8 font-semibold text-fg-primary">
                  {t('feature.productSettings.appPermission.title', { productName, permission: permissionLabel })}
                </p>
                <p className="text-sm leading-5 text-fg-primary">
                  {isAliasPermission
                    ? t('feature.productSettings.aliasPermission.description')
                    : t('feature.productSettings.appPermission.description', {
                        permission: permissionLabel.toLowerCase(),
                        productName,
                      })}
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" data-testid={TEST_IDS.permissionResetButton} onClick={handleResetToDefault}>
                  {t('feature.productSettings.appPermission.resetToDefault')}
                </Button>
              </div>
            </div>

            {!isAliasPermission && meta
              ? modalities.map(modality => {
                  const modalityMeta = getModalityMeta(modality);
                  const description = t(modalityMeta.descriptionKey, {
                    permission: permissionLabel.toLowerCase(),
                    productName,
                  });

                  if (meta.id === 'ExternalRequest') {
                    const patternCount = permissionsService.getExternalRequestPermissions(permissions, modality).length;
                    return (
                      <ModalityNavigationEntry
                        key={modality}
                        label={t(modalityMeta.labelKey)}
                        description={description}
                        noDomainsTitle={t('feature.productSettings.appPermission.noDomainsRequested')}
                        icon={modalityMeta.icon}
                        disabled={patternCount === 0}
                        onClick={() => setWebDomainsModality(modality)}
                      />
                    );
                  }

                  return (
                    <ModalityEntry
                      key={modality}
                      label={t(modalityMeta.labelKey)}
                      description={description}
                      icon={modalityMeta.icon}
                      status={permissionsService.getPermissionStatusForModality(permissions, meta.id, modality)}
                      onStatusChange={status => handleStatusChange(modality, status)}
                    />
                  );
                })
              : null}

            {isAliasPermission ? (
              <ModalityEntry
                label={t('feature.productSettings.aliasPermission.label')}
                description={t('feature.productSettings.aliasPermission.description')}
                icon={<Link2 size={20} />}
                status={permissionsService.rollupPermissionStatus(aliasPermissions.map(entry => entry.status))}
                onStatusChange={status => setAliasStatus(status, aliasPermissions)}
              />
            ) : null}

            {isAliasPermission && hasAliasContexts ? (
              <ModalityNavigationEntry
                label={t('feature.productSettings.aliasPermission.contextsLabel')}
                description={t('feature.productSettings.aliasPermission.contextsDescription')}
                icon={<Link2 size={20} />}
                noDomainsTitle={t('feature.productSettings.aliasPermission.noContextsRequested')}
                disabled={!hasAliasContexts}
                onClick={() => setAliasContextsDialogOpen(true)}
              />
            ) : null}
          </div>
        </div>
      </ScrollArea>
      {webDomainsModality ? (
        <WebDomainsAccessDialog
          open
          productId={productId}
          productName={productName}
          modality={webDomainsModality}
          onOpenChange={open => {
            if (!open) setWebDomainsModality(null);
          }}
        />
      ) : null}
      <AliasContextsAccessDialog
        open={aliasContextsDialogOpen}
        productName={productName}
        aliasPermissions={aliasPermissions}
        onOpenChange={setAliasContextsDialogOpen}
        onStatusChange={(aliasPermission, newStatus) => {
          setAliasStatus(newStatus, [aliasPermission]);
        }}
      />
    </div>
  );
};

type ModalityEntryLayoutProps = {
  label: string;
  description: string;
  icon: ReactNode;
};

const ModalityEntryLayout = ({ label, description, icon }: ModalityEntryLayoutProps) => (
  <div className="flex min-w-0 flex-1 items-center gap-3">
    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-bg-illustration-light text-primary">
      {icon}
    </div>
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-sm font-medium text-fg-primary">{label}</span>
      <span className="truncate text-xs leading-4 text-fg-tertiary">{description}</span>
    </div>
  </div>
);

const ModalityEntry = ({
  label,
  description,
  icon,
  status,
  onStatusChange,
}: ModalityEntryLayoutProps & {
  status: PermissionStatus;
  onStatusChange: (status: PermissionStatus) => void;
}) => (
  <div className="flex items-center gap-4 rounded-xl p-3" data-testid={TEST_IDS.permissionModalityRow}>
    <ModalityEntryLayout label={label} description={description} icon={icon} />
    <PermissionStatusDropdown value={status} onChange={onStatusChange} />
  </div>
);

const ModalityNavigationEntry = ({
  label,
  description,
  icon,
  disabled,
  noDomainsTitle,
  onClick,
}: ModalityEntryLayoutProps & {
  disabled: boolean;
  noDomainsTitle: string;
  onClick: VoidFunction;
}) => (
  <button
    type="button"
    data-testid={TEST_IDS.permissionModalityRow}
    className="flex w-full items-center gap-4 rounded-xl p-3 text-left transition-colors enabled:hover:bg-bg-selection-container-hover disabled:cursor-not-allowed disabled:opacity-50"
    disabled={disabled}
    title={disabled ? noDomainsTitle : undefined}
    onClick={onClick}
  >
    <ModalityEntryLayout label={label} description={description} icon={icon} />
    <ChevronRight size={16} className="shrink-0 text-fg-tertiary" />
  </button>
);
