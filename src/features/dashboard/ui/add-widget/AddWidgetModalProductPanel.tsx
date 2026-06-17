import { Button, ScrollArea, toast } from '@novasamatech/tr-ui';
import { Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type WidgetSizeIconVariant, dashboardLayoutService } from '@/domains/application';
import { type Product, productService, resolveProductUseCase } from '@/domains/product';
import { ProductDialogHeader } from '@/widgets/ProductDialogHeader';
import { WIDGET_SIZE_CONFIG } from '../../constants';
import { getProductIcon } from '../../productIcons';

import { getProductWidgetCardCopy } from './productWidgetCardCopy';
import { useWidgetAddedToast } from './useWidgetAddedToast';
import { PLACEHOLDER_WIDGET_CARDS } from './widgetModalConstants';
import { AddWidgetModalCard } from './widgetModalParts';

export type AddWidgetModalProductPanelProps = {
  selectedProduct: Product;
  favoriteProductIds: ReadonlySet<string>;
  /** Grid size and page of this product's widget on the dashboard, when present. */
  dashboardWidgetPlacement?: { w: number; h: number; pageIndex: number } | null;
  onSelectProduct: (product: Product, size: { w: number; h: number }) => Promise<{ ok: boolean; pageIndex?: number }>;
  onNavigateToDashboardPage: (pageIndex: number) => void;
};

export const AddWidgetModalProductPanel = ({
  selectedProduct,
  favoriteProductIds,
  dashboardWidgetPlacement = null,
  onSelectProduct,
  onNavigateToDashboardPage,
}: AddWidgetModalProductPanelProps) => {
  const { t } = useTranslation();

  const [selectedVariants, setSelectedVariants] = useState<Record<string, WidgetSizeIconVariant>>({});

  const isWidgetAlreadyOnDashboard = dashboardWidgetPlacement !== null;

  // `hasSupportedSizes: false` → manifest declares no supported sizes; the card
  // still renders but its size picker + Add button become an info block (and the
  // developer hint is logged below). `null` → nothing to render.
  const widgetCard = useMemo(() => {
    const isChat = selectedProduct.baseName === 'chat';
    const placeholder = PLACEHOLDER_WIDGET_CARDS.find(card => card.id === (isChat ? 'chat-widget' : 'product-widget'));
    if (!placeholder) return null;

    if (isChat) return { card: placeholder, hasSupportedSizes: true };

    const dimensions = selectedProduct.executables.widget?.dimensions;
    if (!dimensions) return { card: placeholder, hasSupportedSizes: true };

    const sizeVariants = dashboardLayoutService.sizeHintsToVariants(dimensions);
    if (sizeVariants.length === 0) return { card: placeholder, hasSupportedSizes: false };

    // Always offer every size declared in the manifest. When the widget is
    // already on the dashboard the current size is highlighted (see the effect
    // below) and switching is disabled, but all sizes stay visible.
    return {
      card: { ...placeholder, sizeVariants, previewVariant: sizeVariants[0] ?? placeholder.previewVariant },
      hasSupportedSizes: true,
    };
  }, [selectedProduct]);

  useEffect(() => {
    if (widgetCard && !widgetCard.hasSupportedSizes) {
      console.error(
        `The widget doesn't have any supported sizes for adding. If you're developer of this widget please declare: "height": [1] for small, "height": [2] for medium, "height": [4] for large, and "height": [0] && "width": 2 for horizontal in the Manifest widget dimensions.`,
        selectedProduct.baseName,
      );
    }
  }, [widgetCard, selectedProduct.baseName]);

  useEffect(() => {
    if (!widgetCard || !widgetCard.hasSupportedSizes) return;

    const { card } = widgetCard;

    // Already on the dashboard → preselect (highlight) the current size; otherwise
    // default to the first supported size.
    if (dashboardWidgetPlacement) {
      const placementVariant = dashboardLayoutService.getVariantFromGridSize(
        dashboardWidgetPlacement.w,
        dashboardWidgetPlacement.h,
      );
      const selected = card.sizeVariants.includes(placementVariant) ? placementVariant : (card.sizeVariants[0] ?? 'small');
      setSelectedVariants({ [card.id]: selected });
      return;
    }

    setSelectedVariants({ [card.id]: card.sizeVariants[0] ?? 'small' });
  }, [widgetCard, dashboardWidgetPlacement]);

  const isProductInFavorites = useMemo(() => {
    return favoriteProductIds.has(selectedProduct.baseName);
  }, [selectedProduct.baseName, favoriteProductIds]);

  const showSuccessToastWithView = useWidgetAddedToast(onNavigateToDashboardPage);

  const handleOpenWidget = () => {
    if (!dashboardWidgetPlacement) return;

    onNavigateToDashboardPage(dashboardWidgetPlacement.pageIndex);
  };

  // Prefer the product the panel already resolved through the 60s-cached chain
  // resolver (`useDisplayedProduct`); only hit the chain directly when it hasn't
  // resolved yet. `fetchProductFromChain` rejects on any RPC failure, so the
  // fallback is guarded — an unhandled rejection here would leave the Add button
  // a silent no-op (the handler is fire-and-forget).
  const resolveWidgetProduct = async (): Promise<Product | null> => {
    if (productService.hasWidget(selectedProduct)) return selectedProduct;
    try {
      return await resolveProductUseCase.fetchProductFromChain(selectedProduct.baseName);
    } catch {
      return null;
    }
  };

  const handleAddWidget = async (cardId: string) => {
    const variant = selectedVariants[cardId];
    if (!variant) return;

    const resolved = await resolveWidgetProduct();
    if (!resolved || !productService.hasWidget(resolved)) {
      toast.error(t('feature.dashboard.addWidget.toast.widgetAddFailed'));
      return;
    }

    const outcome = await onSelectProduct(resolved, WIDGET_SIZE_CONFIG[variant].size);
    if (!outcome.ok) {
      toast.error(t('feature.dashboard.addWidget.toast.widgetAddFailed'));
      return;
    }

    const card = PLACEHOLDER_WIDGET_CARDS.find(c => c.id === cardId);
    if (!card) return;

    showSuccessToastWithView(
      t('feature.dashboard.addWidget.toast.widgetAddedProduct', {
        widgetTitle: selectedProduct.displayName,
        sizeLabel: t(WIDGET_SIZE_CONFIG[variant].labelKey).toLowerCase(),
      }),
      outcome.pageIndex,
    );
  };

  const handleAddToFavorites = async () => {
    if (isProductInFavorites) return;

    const outcome = await onSelectProduct(selectedProduct, { w: 1, h: 1 });
    if (!outcome.ok) {
      toast.error(t('feature.dashboard.addWidget.toast.favoritesAddFailed'));
      return;
    }

    showSuccessToastWithView(
      t('feature.dashboard.addWidget.toast.addedToFavorites', { productName: selectedProduct.displayName }),
      outcome.pageIndex,
    );
  };

  const NativeIcon = getProductIcon(selectedProduct.baseName);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg-surface-container">
      <ProductDialogHeader product={selectedProduct} icon={NativeIcon ? <NativeIcon className="size-full" /> : undefined} />

      <div className="flex shrink-0 justify-start pt-8 pb-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isProductInFavorites}
          aria-label={
            isProductInFavorites
              ? t('feature.dashboard.addWidget.addedToFavoritesButton')
              : t('feature.dashboard.addWidget.addToFavorites')
          }
          onClick={handleAddToFavorites}
        >
          <span className="inline-flex items-center gap-1 text-xs leading-4 font-normal">
            <Star
              className={cnTw('size-4 shrink-0', isProductInFavorites ? 'fill-current text-fg-secondary' : 'text-fg-primary')}
              aria-hidden
              strokeWidth={1.75}
            />
            {isProductInFavorites
              ? t('feature.dashboard.addWidget.addedToFavoritesButton')
              : t('feature.dashboard.addWidget.addToFavorites')}
          </span>
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden pt-4">
        <ScrollArea>
          <div className="flex flex-col gap-4">
            {widgetCard ? (
              <AddWidgetModalCard
                key={widgetCard.card.id}
                card={widgetCard.card}
                hasSupportedSizes={widgetCard.hasSupportedSizes}
                copy={
                  widgetCard.card.id === 'product-widget'
                    ? getProductWidgetCardCopy(selectedProduct, widgetCard.card.descriptionKey, t)
                    : undefined
                }
                selectedVariant={selectedVariants[widgetCard.card.id] ?? widgetCard.card.sizeVariants[0] ?? 'small'}
                isWidgetAlreadyOnDashboard={isWidgetAlreadyOnDashboard}
                onSelectSize={variant => {
                  setSelectedVariants(prev => ({ ...prev, [widgetCard.card.id]: variant }));
                }}
                onAdd={() => handleAddWidget(widgetCard.card.id)}
                onOpen={handleOpenWidget}
              />
            ) : null}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
