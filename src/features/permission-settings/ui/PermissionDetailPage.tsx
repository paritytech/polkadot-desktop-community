import { ScrollArea } from '@novasamatech/tr-ui';
import { useNavigate } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, Grid2X2, Shield } from 'lucide-react';
import { cloneElement } from 'react';

import { useTranslation } from '@/shared/translation';
import {
  type AppPermissionEntry,
  type PermissionModality,
  useAggregatedPermission,
  useDisplayedProduct,
} from '@/domains/product';
import { getModalityMeta, getPermissionMeta } from '@/widgets/Permission';
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

  const { data: current } = useAggregatedPermission(permissionId);

  if (!meta) {
    return null;
  }

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
              <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-bg-illustration-light text-fg-primary">
                {cloneElement(meta.icon, { size: 40 })}
              </div>
              <div className="flex flex-col gap-2">
                <div className="text-2xl leading-8 font-semibold text-fg-primary">{t(meta.labelKey)}</div>
                <div className="text-sm leading-5 text-fg-primary">{t(meta.descriptionKey)}</div>
              </div>

              <RulesCard ruleKeys={meta.ruleKeys} />
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-sm leading-5 font-semibold text-fg-primary">
                {t('feature.permissionSettings.detail.appsLabel')}
              </div>
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
    <div className="rounded-lg border border-general-border bg-bg-surface-container p-3">
      <div className="mb-2 flex items-center gap-1">
        <Shield size={16} className="text-fg-secondary" />
        <span className="text-sm leading-5 font-medium text-fg-secondary">
          {t('feature.permissionSettings.detail.rulesTitle')}
        </span>
      </div>
      <ol className="flex list-decimal flex-col pl-5">
        {ruleKeys.map(key => (
          <li key={key} className="text-sm leading-5 text-fg-primary">
            {t(key)}
          </li>
        ))}
      </ol>
    </div>
  );
};

const AppIdentity = ({ productId, allowedModalities }: { productId: string; allowedModalities: PermissionModality[] }) => {
  const { t } = useTranslation();
  const { data: product } = useDisplayedProduct(productId);
  const productName = product?.displayName ?? productId;
  const baseName = product?.baseName ?? productId;
  const allowedLabel =
    allowedModalities.length > 0
      ? t('feature.permissionSettings.detail.allowedFor', {
          modalities: allowedModalities.map(modality => t(getModalityMeta(modality).labelKey)).join(', '),
        })
      : null;

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
        <span className="truncate text-sm leading-5 font-medium text-fg-primary">{productName}</span>
        <span className="truncate text-xs leading-4 text-fg-tertiary">
          {allowedLabel ? t('feature.permissionSettings.detail.appSubtitle', { baseName, allowed: allowedLabel }) : baseName}
        </span>
      </div>
    </>
  );
};

const AppPermissionRow = ({ app, onNavigate }: { app: AppPermissionEntry; onNavigate: VoidFunction }) => (
  <button
    className="flex w-full items-center gap-4 rounded-xl p-3 text-left transition-colors hover:bg-bg-selection-container-hover"
    onClick={onNavigate}
  >
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <AppIdentity productId={app.productId} allowedModalities={app.allowedModalities} />
    </div>
    <ChevronRight size={16} className="shrink-0 text-fg-tertiary" />
  </button>
);
