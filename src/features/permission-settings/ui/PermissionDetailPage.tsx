import { useNavigate } from '@tanstack/react-router';
import { Grid2X2, Shield } from 'lucide-react';
import { cloneElement, useMemo } from 'react';

import { ListItem, SettingsList, SettingsSection } from '@/shared/components';
import { useTranslation } from '@/shared/translation';
import { type AppPermissionEntry, useDisplayedProduct, useWatchAggregatedPermissions } from '@/domains/product';
import { getPermissionMeta } from '@/widgets/Permission';
import { ProductIcon } from '@/widgets/ProductIcon';

type Props = {
  permissionId: string;
  onBack: VoidFunction;
};

export const PermissionDetailPage = ({ permissionId, onBack }: Props) => {
  const { t } = useTranslation();
  const meta = getPermissionMeta(permissionId);
  const navigate = useNavigate();

  const { data: aggregated, fulfilled } = useWatchAggregatedPermissions();
  // A single-entry lookup over the same rollup; there is no per-permission read,
  // because the rollup's cost is one batched core call per product either way.
  const current = useMemo(
    () => (permissionId ? (aggregated.find(entry => entry.id === permissionId) ?? null) : null),
    [aggregated, permissionId],
  );

  if (!meta) {
    return null;
  }

  return (
    <SettingsList title={t(meta.labelKey)} onBack={onBack}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-bg-illustration-light text-fg-primary">
            {cloneElement(meta.icon, { className: 'size-10' })}
          </div>

          <p className="text-sm text-chrome-muted">{t(meta.descriptionKey)}</p>

          <RulesCard ruleKeys={meta.ruleKeys} />
        </div>

        <SettingsSection layout="list" title={t('feature.permissionSettings.detail.appsLabel')}>
          {/* The rollup has no entry for a permission no product holds, so a missing entry is "no apps" too. */}
          {fulfilled && !current?.apps.length && (
            <div className="px-3 py-4 text-center text-xs text-chrome-muted">{t('feature.permissionSettings.detail.noApps')}</div>
          )}
          {current?.apps.map(app => (
            <AppPermissionRow
              key={app.productId}
              app={app}
              onNavigate={() =>
                navigate({
                  to: '/settings/privacy/permissions/$permissionId/$productId',
                  params: { permissionId, productId: app.productId },
                })
              }
            />
          ))}
        </SettingsSection>
      </div>
    </SettingsList>
  );
};

const RulesCard = ({ ruleKeys }: { ruleKeys: string[] }) => {
  const { t } = useTranslation();
  return (
    <SettingsSection>
      <div className="mb-2 flex items-center gap-1">
        <Shield size={16} className="text-chrome-muted" />
        <span className="text-sm font-medium text-chrome-muted">{t('feature.permissionSettings.detail.rulesTitle')}</span>
      </div>
      <ol className="flex list-decimal flex-col ps-5">
        {ruleKeys.map(key => (
          <li key={key} className="text-sm text-chrome-text">
            {t(key)}
          </li>
        ))}
      </ol>
    </SettingsSection>
  );
};

const AppPermissionRow = ({ app, onNavigate }: { app: AppPermissionEntry; onNavigate: VoidFunction }) => {
  const { data: product } = useDisplayedProduct(app.productId);

  return (
    <ListItem
      icon={<ProductIcon icon={product?.icon} className="size-full object-cover" fallback={<Grid2X2 />} />}
      label={product?.displayName ?? app.productId}
      description={product?.baseName ?? app.productId}
      chevron
      onClick={onNavigate}
    />
  );
};
