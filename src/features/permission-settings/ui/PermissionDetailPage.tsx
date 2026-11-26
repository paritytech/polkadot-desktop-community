import { useNavigate } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, Grid2X2, Shield } from 'lucide-react';
import { cloneElement, useMemo } from 'react';

import { Button, ScrollArea } from '@/shared/components';
import { useTranslation } from '@/shared/translation';
import { type AppPermissionEntry, useDisplayedProduct, useWatchAggregatedPermissions } from '@/domains/product';
import { getPermissionMeta } from '@/widgets/Permission';
import { ProductIcon } from '@/widgets/ProductIcon';

type Props = {
  permissionId: string;
  backLabel: string;
  onBack: VoidFunction;
};

export const PermissionDetailPage = ({ permissionId, backLabel, onBack }: Props) => {
  const { t } = useTranslation();
  const meta = getPermissionMeta(permissionId);
  const navigate = useNavigate();

  const { data: aggregated } = useWatchAggregatedPermissions();
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
    <div className="flex min-h-0 flex-col overflow-hidden">
      <ScrollArea>
        <div className="flex min-h-0 flex-col items-center">
          <div className="flex min-h-0 w-150 max-w-full flex-col gap-6 px-2 py-3">
            <span className="flex self-start">
              <Button variant="ghost" onClick={onBack}>
                <ChevronLeft />
                {backLabel}
              </Button>
            </span>

            <div className="flex flex-col gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-bg-illustration-light text-fg-primary">
                {cloneElement(meta.icon, { size: 40 })}
              </div>
              <div className="flex flex-col gap-2">
                <div className="text-2xl font-semibold text-fg-primary">{t(meta.labelKey)}</div>
                <div className="text-sm text-fg-primary">{t(meta.descriptionKey)}</div>
              </div>

              <RulesCard ruleKeys={meta.ruleKeys} />
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-sm font-semibold text-fg-primary">{t('feature.permissionSettings.detail.appsLabel')}</div>
              {current?.apps.length === 0 && (
                <div className="py-4 text-center text-sm text-fg-tertiary">{t('feature.permissionSettings.detail.noApps')}</div>
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
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

const RulesCard = ({ ruleKeys }: { ruleKeys: string[] }) => {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-stroke-primary bg-bg-surface-container p-3">
      <div className="mb-2 flex items-center gap-1">
        <Shield size={16} className="text-fg-secondary" />
        <span className="text-sm font-medium text-fg-secondary">{t('feature.permissionSettings.detail.rulesTitle')}</span>
      </div>
      <ol className="flex list-decimal flex-col ps-5">
        {ruleKeys.map(key => (
          <li key={key} className="text-sm text-fg-primary">
            {t(key)}
          </li>
        ))}
      </ol>
    </div>
  );
};

const AppIdentity = ({ productId }: { productId: string }) => {
  const { data: product } = useDisplayedProduct(productId);
  const productName = product?.displayName ?? productId;
  const baseName = product?.baseName ?? productId;

  return (
    <>
      <div className="size-10 shrink-0 overflow-hidden rounded-xl">
        <ProductIcon
          icon={product?.icon}
          className="size-full object-cover"
          fallback={
            <div className="flex size-full items-center justify-center bg-bg-illustration-light text-fg-primary">
              <Grid2X2 size={20} />
            </div>
          }
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-fg-primary">{productName}</span>
        <span className="truncate text-xs text-fg-tertiary">
          {/* A decision no longer carries a surface, so the base name is the whole subtitle. */}
          {baseName}
        </span>
      </div>
    </>
  );
};

const AppPermissionRow = ({ app, onNavigate }: { app: AppPermissionEntry; onNavigate: VoidFunction }) => (
  <button
    className="flex w-full items-center gap-4 rounded-xl p-3 text-start transition-colors hover:bg-bg-selection-container-hover"
    onClick={onNavigate}
  >
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <AppIdentity productId={app.productId} />
    </div>
    <ChevronRight size={16} className="shrink-0 text-fg-tertiary" />
  </button>
);
