import { Grid2X2, Link2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { Button, ListItem, SettingsList, SettingsSection } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { useDisplayedProduct } from '@/domains/product';
import {
  type PermissionStatus,
  permissionsService,
  useSetPermissionStatus,
  useWatchGrantedAccountAccess,
  useWatchGrantedPatterns,
  useWatchProductPermissions,
} from '@/domains/product';
import { PermissionStatusDropdown, getPermissionMeta } from '@/widgets/Permission';
import { ProductIcon } from '@/widgets/ProductIcon';

import { AliasContextsAccessDialog } from './AliasContextsAccessDialog';
import { WebDomainsAccessDialog } from './WebDomainsAccessDialog';

type Props = {
  productId: string;
  permissionId: string;
  onBack: VoidFunction;
};

export const AppPermissionEntityPage = ({ productId, permissionId, onBack }: Props) => {
  const { t } = useTranslation();
  const { data: product } = useDisplayedProduct(productId);
  const isAliasPermission = permissionId === 'Alias';
  const meta = getPermissionMeta(permissionId);
  const { data: entries } = useWatchProductPermissions(productId);
  const { data: patterns } = useWatchGrantedPatterns(productId);
  const { data: accountAccess } = useWatchGrantedAccountAccess(productId);
  const setStatus = useSetPermissionStatus();
  const [webDomainsOpen, setWebDomainsOpen] = useState(false);
  const [aliasContextsDialogOpen, setAliasContextsDialogOpen] = useState(false);

  if (!meta && !isAliasPermission) return null;

  const permissionLabel = isAliasPermission ? t('feature.productSettings.aliasPermission.label') : t(meta?.labelKey ?? '');
  const productName = product?.displayName ?? productId;
  const hasAliasContexts = accountAccess.length > 0;
  const headerIcon = isAliasPermission ? <Link2 size={20} /> : meta?.icon;
  const title = t('feature.productSettings.appPermission.title', { productName, permission: permissionLabel });
  const description = isAliasPermission
    ? t('feature.productSettings.aliasPermission.description')
    : t('feature.productSettings.appPermission.description', { permission: permissionLabel.toLowerCase(), productName });

  // An account-access row has no single slot to read: its key space is one slot per
  // target product. Roll the entries up instead. The external-request row navigates to
  // its own dialog rather than carrying a status.
  const accountAccessStatus = permissionsService.rollupPermissionStatus(accountAccess.map(entry => entry.status));
  const catalogueStatus = entries.find(entry => entry.permissionId === meta?.id)?.status ?? 'ask';

  const setAccountAccessStatus = (targetProductId: string, newStatus: PermissionStatus) => {
    setStatus.run({ productId, request: permissionsService.toAccountAccessRequest(targetProductId), status: newStatus });
  };

  const setEveryAccountAccessStatus = (newStatus: PermissionStatus) => {
    for (const entry of accountAccess) setAccountAccessStatus(entry.targetProductId, newStatus);
  };

  const setPatternStatus = (pattern: string, newStatus: PermissionStatus) => {
    const request = permissionsService.toAuthorizationRequest('ExternalRequest', { pattern });
    if (!request) return;

    setStatus.run({ productId, request, status: newStatus });
  };

  const handleStatusChange = (newStatus: PermissionStatus) => {
    if (!meta) return;

    // The external-request row writes through to every granted domain: it has no slot
    // of its own to carry the answer.
    if (meta.id === 'ExternalRequest') {
      for (const entry of patterns) setPatternStatus(entry.pattern, newStatus);
      return;
    }

    const request = permissionsService.toAuthorizationRequest(meta.id);
    if (!request) return;

    setStatus.run({ productId, request, status: newStatus });
  };

  // 'ask' is how the core is told to prompt again, which is what resetting means.
  const handleResetToDefault = () => {
    if (isAliasPermission) {
      setEveryAccountAccessStatus('ask');
      return;
    }

    handleStatusChange('ask');
  };

  return (
    <>
      <SettingsList title={title} onBack={onBack}>
        <div className="flex flex-col gap-6">
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
              <div className="absolute -end-1 -bottom-1 flex size-10 items-center justify-center rounded-xl bg-bg-surface-container text-fg-primary">
                {headerIcon}
              </div>
            </div>

            <div className="flex gap-2">
              <Button data-testid={TEST_IDS.permissionResetButton} onClick={handleResetToDefault}>
                {t('feature.productSettings.appPermission.resetToDefault')}
              </Button>
            </div>
          </div>

          <SettingsSection layout="list">
            {!isAliasPermission && meta && meta.id === 'ExternalRequest' ? (
              <PermissionNavigationEntry
                label={permissionLabel}
                description={description}
                noDomainsTitle={t('feature.productSettings.appPermission.noDomainsRequested')}
                icon={meta.icon}
                disabled={patterns.length === 0}
                onClick={() => setWebDomainsOpen(true)}
              />
            ) : null}

            {!isAliasPermission && meta && meta.id !== 'ExternalRequest' ? (
              <PermissionEntry
                label={permissionLabel}
                description={description}
                icon={meta.icon}
                status={catalogueStatus}
                onStatusChange={handleStatusChange}
              />
            ) : null}

            {isAliasPermission ? (
              <PermissionEntry
                label={t('feature.productSettings.aliasPermission.label')}
                description={description}
                icon={<Link2 />}
                status={accountAccessStatus}
                onStatusChange={setEveryAccountAccessStatus}
              />
            ) : null}

            {isAliasPermission && hasAliasContexts ? (
              <PermissionNavigationEntry
                label={t('feature.productSettings.aliasPermission.contextsLabel')}
                description={t('feature.productSettings.aliasPermission.contextsDescription')}
                icon={<Link2 />}
                noDomainsTitle={t('feature.productSettings.aliasPermission.noContextsRequested')}
                disabled={!hasAliasContexts}
                onClick={() => setAliasContextsDialogOpen(true)}
              />
            ) : null}
          </SettingsSection>
        </div>
      </SettingsList>
      <WebDomainsAccessDialog
        open={webDomainsOpen}
        productId={productId}
        productName={productName}
        onOpenChange={setWebDomainsOpen}
      />
      <AliasContextsAccessDialog
        open={aliasContextsDialogOpen}
        productName={productName}
        accountAccess={accountAccess}
        onOpenChange={setAliasContextsDialogOpen}
        onStatusChange={setAccountAccessStatus}
      />
    </>
  );
};

type PermissionEntryProps = {
  label: string;
  description: string;
  icon: ReactNode;
};

const PermissionEntry = ({
  label,
  description,
  icon,
  status,
  onStatusChange,
}: PermissionEntryProps & {
  status: PermissionStatus;
  onStatusChange: (status: PermissionStatus) => void;
}) => (
  <ListItem
    icon={icon}
    label={label}
    description={description}
    action={<PermissionStatusDropdown value={status} onChange={onStatusChange} />}
    testId={TEST_IDS.permissionRow}
  />
);

const PermissionNavigationEntry = ({
  label,
  description,
  icon,
  disabled,
  noDomainsTitle,
  onClick,
}: PermissionEntryProps & {
  disabled: boolean;
  noDomainsTitle: string;
  onClick: VoidFunction;
}) => (
  <ListItem
    icon={icon}
    label={label}
    description={description}
    chevron
    disabled={disabled}
    title={disabled ? noDomainsTitle : undefined}
    testId={TEST_IDS.permissionRow}
    onClick={onClick}
  />
);
