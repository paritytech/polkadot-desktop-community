import { useNavigate } from '@tanstack/react-router';
import { Maximize2, RotateCw } from 'lucide-react';

import { DropdownMenu, IconButton } from '@/shared/components';
import { isElectron } from '@/shared/env';
import { createFeature } from '@/shared/feature';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import {
  type DashboardCardLayoutRules,
  type DashboardCardPayload,
  type WidgetSizeHints,
  dashboardLayoutService,
} from '@/domains/application';
import { productService, useDisplayedProduct, useExecutableArchive, usePersistedProductById } from '@/domains/product';
import { onProductRefreshRequestedSideEffect } from '@/aggregates/product-loading';
import {
  type CardRenderProps,
  DashboardCardChrome,
  dashboardCardSDK,
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

const PRODUCT_WIDGET_FALLBACK_LAYOUT_RULES: DashboardCardLayoutRules = {
  minH: 4,
  maxH: 8,
  minW: 1,
  maxW: 2,
  switchableSizes: ['small', 'medium', 'large', 'horizontal'],
  availableSizes: ['ICON', 'HALF', 'FULL'],
  defaultSize: 'ICON',
};

function productWidgetLayoutRules(dimensions: WidgetSizeHints | undefined): DashboardCardLayoutRules {
  if (!dimensions) return PRODUCT_WIDGET_FALLBACK_LAYOUT_RULES;

  const rules = dashboardLayoutService.sizeHintsToLayoutRules(dimensions);
  // Invalid manifest dimensions: the widget can no longer be added, but one may
  // already be on the dashboard — lock it to its current size (the header menu
  // shows only that size, non-switchable).
  if (!rules) return { ...PRODUCT_WIDGET_FALLBACK_LAYOUT_RULES, lockSizeToCurrent: true };

  return rules;
}

const ProductWidgetContent = (props: CardRenderProps) => {
  const productId = productIdOf(props.card.payload);
  // Resolve committed-or-chain so the size menu reflects the manifest even for
  // products that aren't committed to the DB. The resolved rules are passed to
  // `DashboardCardChrome` via the `layoutRules` prop below.
  const { data: product, pending: productPending } = useDisplayedProduct(productId);
  // Single source of product resolution + loading for the widget: the chrome
  // pulses on `isLoading`, and the body receives `product`/`content` as props.
  const { data: content, pending: archivePending } = useExecutableArchive(product ? { product, kind: 'widget' } : null);
  const isLoading = productPending || (Boolean(product) && archivePending);

  if (productId === null) return null;
  if (props.height === 1) return <ProductShortcutCard productId={productId} />;

  return (
    <DashboardCardChrome
      card={props.card}
      width={props.width}
      height={props.height}
      layoutRules={productWidgetLayoutRules(product?.executables.widget?.dimensions)}
      testId={TEST_IDS.dashboardProductWidget}
      isLoading={isLoading}
      isMenuOpen={props.isMenuOpen}
      onMenuOpenChange={open => props.onMenuOpenChange(props.menuId, open)}
      onResizeCard={props.onResizeCard}
      onRemoveCard={props.onRemoveCard}
      onCleanupCards={props.onCleanupCards}
    >
      {isElectron() ? (
        <ProductWidgetBody
          productId={productId}
          product={product}
          hasContent={Boolean(content)}
          pending={isLoading}
          onRemoveCard={props.onRemoveCard}
        />
      ) : (
        <WebFallback />
      )}
    </DashboardCardChrome>
  );
};

dashboardCardSDK(productWidgetFeature, {
  content: props => <ProductWidgetContent {...props} />,

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
        <FullscreenAction productId={productId} />
      </div>
    );
  },

  menuItems: ({ payload }) => {
    const productId = productIdOf(payload);
    if (productId === null) return null;
    return <WidgetMenuItems productId={productId} />;
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

const WidgetMenuItems = ({ productId }: { productId: string }) => {
  const { t } = useTranslation();

  return (
    <DropdownMenu.Item
      data-testid={TEST_IDS.productWidgetReloadButton}
      onClick={() => void onProductRefreshRequestedSideEffect.apply({ identifier: productId })}
    >
      <RotateCw className="size-4" />
      <span className="flex-1">{t('feature.dashboard.widgetMenu.reload')}</span>
    </DropdownMenu.Item>
  );
};

const FullscreenAction = ({ productId }: { productId: string }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: product } = usePersistedProductById(productId);
  if (!product || !productService.hasApp(product)) return null;

  return (
    <span className={widgetTopbarActionVisibilityClass}>
      <IconButton
        size="sm"
        data-testid={TEST_IDS.dashboardWidgetFullscreenButton}
        label={t('common.aria.openFullscreen')}
        onClick={() => navigate({ to: '/product/$id/{-$route}', params: { id: product.baseName } })}
        onMouseDown={event => event.stopPropagation()}
      >
        <Maximize2 aria-hidden />
      </IconButton>
    </span>
  );
};

const WebFallback = () => {
  const { t } = useTranslation();
  return (
    <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-fg-secondary">
      {t('feature.browser.webVersionNotification')}
    </div>
  );
};
