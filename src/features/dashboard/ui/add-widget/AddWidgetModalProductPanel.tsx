import { Button, ScrollArea, toast } from '@novasamatech/tr-ui';
import { Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type WidgetSizeIconVariant } from '@/domains/application';
import { type Product, productService, resolveProductUseCase } from '@/domains/product';
import { ProductDialogHeader } from '@/widgets/ProductDialogHeader';
import { WIDGET_SIZE_CONFIG } from '../../constants';
import { getProductIcon } from '../../productIcons';

import { getProductWidgetCardCopy } from './productWidgetCardCopy';
import { useWidgetAddedToast } from './useWidgetAddedToast';
import { PLACEHOLDER_WIDGET_CARDS, getVariantFromGridSize } from './widgetModalConstants';
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

  useEffect(() => {
    const targetCardId = selectedProduct.baseName === 'chat' ? 'chat-widget' : 'product-widget';

    if (dashboardWidgetPlacement) {
      setSelectedVariants({
        [targetCardId]: getVariantFromGridSize(dashboardWidgetPlacement.w, dashboardWidgetPlacement.h),
      });
      return;
    }

    setSelectedVariants({ [targetCardId]: 'small' });
  }, [dashboardWidgetPlacement, selectedProduct.baseName]);

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
            {PLACEHOLDER_WIDGET_CARDS.filter(
              card => card.id === (selectedProduct.baseName === 'chat' ? 'chat-widget' : 'product-widget'),
            ).map(card => {
              const selectedVariant = selectedVariants[card.id] ?? card.sizeVariants[0] ?? 'small';
              const cardCopy =
                card.id === 'product-widget' ? getProductWidgetCardCopy(selectedProduct, card.descriptionKey, t) : undefined;

              return (
                <AddWidgetModalCard
                  key={card.id}
                  card={card}
                  copy={cardCopy}
                  selectedVariant={selectedVariant}
                  isWidgetAlreadyOnDashboard={isWidgetAlreadyOnDashboard}
                  onSelectSize={variant => {
                    setSelectedVariants(prev => ({ ...prev, [card.id]: variant }));
                  }}
                  onAdd={() => handleAddWidget(card.id)}
                  onOpen={handleOpenWidget}
                />
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
