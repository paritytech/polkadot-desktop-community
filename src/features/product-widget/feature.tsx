import { useNavigate } from '@tanstack/react-router';
import { Maximize2, RefreshCw } from 'lucide-react';

import { isElectron } from '@/shared/env';
import { createFeature } from '@/shared/feature';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type DashboardCardLayoutRules, type DashboardCardPayload } from '@/domains/application';
import { productService, usePersistedProductById } from '@/domains/product';
import { onProductRefreshRequestedSideEffect, useProductRefreshing } from '@/aggregates/product-loading';
import {
  DashboardCardChrome,
  dashboardCardSDK,
  widgetTopbarActionButtonClass,
  widgetTopbarActionVisibilityClass,
} from '@/features/dashboard';
import { ProductIcon } from '@/widgets/ProductIcon';

import { ProductShortcutCard } from './ui/ProductShortcutCard';
import { ProductWidgetBody } from './ui/ProductWidgetBody';

export const PRODUCT_WIDGET_KIND = 'product:widget';

export const productWidgetFeature = createFeature({
  name: 'product/widget',
});

type ProductWidgetPayload = { kind: typeof PRODUCT_WIDGET_KIND; productId: string };

function productIdOf(payload: DashboardCardPayload): string | null {
  if (payload.kind !== PRODUCT_WIDGET_KIND) return null;
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return (payload as ProductWidgetPayload).productId;
}

const PRODUCT_WIDGET_LAYOUT_RULES: DashboardCardLayoutRules = {
  minH: 4,
  maxH: 8,
  minW: 1,
  maxW: 2,
  menuSizes: ['small', 'medium', 'large', 'horizontal'],
  availableSizes: ['ICON', 'HALF', 'FULL'],
  defaultSize: 'ICON',
};

dashboardCardSDK(productWidgetFeature, {
  content: props => {
    const productId = productIdOf(props.card.payload);
    if (productId === null) return null;
    if (props.height === 1) return <ProductShortcutCard productId={productId} />;

    return (
      <DashboardCardChrome
        card={props.card}
        width={props.width}
        height={props.height}
        isMenuOpen={props.isMenuOpen}
        onMenuOpenChange={open => props.onMenuOpenChange(props.menuId, open)}
        onResizeCard={props.onResizeCard}
        onRemoveCard={props.onRemoveCard}
        onCleanupCards={props.onCleanupCards}
      >
        {isElectron() ? <ProductWidgetBody productId={productId} /> : <WebFallback />}
      </DashboardCardChrome>
    );
  },

  layout: payload => (payload.kind === PRODUCT_WIDGET_KIND ? PRODUCT_WIDGET_LAYOUT_RULES : null),

  metadata: payload => {
    const productId = productIdOf(payload);
    if (productId === null) return null;
    return {
      icon: <ProductLabelIcon productId={productId} />,
      label: <ProductLabel productId={productId} />,
    };
  },

  actions: ({ payload }) => {
    const productId = productIdOf(payload);
    if (productId === null) return null;
    return (
      <div className="flex shrink-0 items-center gap-2">
        <ReloadAction productId={productId} />
        <FullscreenAction productId={productId} />
      </div>
    );
  },
});

const ProductLabel = ({ productId }: { productId: string }) => {
  const { data: product } = usePersistedProductById(productId);
  return product?.displayName ?? productId;
};

const ProductLabelIcon = ({ productId }: { productId: string }) => {
  const { data: product } = usePersistedProductById(productId);
  return (
    <ProductIcon
      icon={product?.icon ?? null}
      className="size-5 shrink-0 rounded"
      fallback={<div className="size-5 shrink-0 rounded bg-bg-action-secondary" />}
    />
  );
};

const ReloadAction = ({ productId }: { productId: string }) => {
  const { t } = useTranslation();
  const { isRefreshing } = useProductRefreshing(productId);

  return (
    <span className={widgetTopbarActionVisibilityClass}>
      <button
        type="button"
        data-testid={TEST_IDS.productWidgetReloadButton}
        aria-label={t('common.aria.reloadWidget')}
        className={widgetTopbarActionButtonClass}
        onClick={() => void onProductRefreshRequestedSideEffect.apply({ identifier: productId })}
        onMouseDown={event => event.stopPropagation()}
      >
        <RefreshCw className={cnTw('size-4', isRefreshing && 'animate-spin')} aria-hidden />
      </button>
    </span>
  );
};

const FullscreenAction = ({ productId }: { productId: string }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: product } = usePersistedProductById(productId);
  if (!product || !productService.hasApp(product)) return null;

  return (
    <span className={widgetTopbarActionVisibilityClass}>
      <button
        type="button"
        aria-label={t('common.aria.openFullscreen')}
        className={widgetTopbarActionButtonClass}
        onClick={() => navigate({ to: '/product/$id/{-$route}', params: { id: product.baseName } })}
        onMouseDown={event => event.stopPropagation()}
      >
        <Maximize2 className="size-4" aria-hidden />
      </button>
    </span>
  );
};

const WebFallback = () => {
  const { t } = useTranslation();
  return (
    <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
      {t('feature.browser.webVersionNotification')}
    </div>
  );
};
