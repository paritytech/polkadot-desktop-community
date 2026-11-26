import { useEffect, useMemo, useState } from 'react';

import { ScrollArea, toast } from '@/shared/components';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type DashboardCard, type WidgetSizeIconVariant, dashboardLayoutService } from '@/domains/application';
import { ProductDialogHeader } from '@/widgets/ProductDialogHeader';
import { WIDGET_SIZE_CONFIG } from '../../constants';
import { type AddableDashboardCard } from '../../di';

import { useWidgetAddedToast } from './useWidgetAddedToast';
import { type WidgetCardDefinition } from './widgetModalConstants';
import { AddWidgetFavoritesButton, AddWidgetModalCard } from './widgetModalParts';

export type AddWidgetModalNativePanelFavorites = {
  ids: ReadonlySet<string>;
  onAdd: (entry: AddableDashboardCard) => Promise<{ ok: boolean; pageIndex?: number }>;
};

export type AddWidgetModalNativePanelProps = {
  entry: AddableDashboardCard;
  dashboardPages: DashboardCard[][];
  onAddNativeCard: (entry: AddableDashboardCard, size: { w: number; h: number }) => Promise<{ ok: boolean; pageIndex?: number }>;
  onNavigateToDashboardPage: (pageIndex: number) => void;
  // When set and `entry.supportsFavorites`, renders the 1×1 "Add to Favorites"
  // button. Both the Add Widget catalog modal and the AtD dialog pass this.
  favorites?: AddWidgetModalNativePanelFavorites;
};

export const AddWidgetModalNativePanel = ({
  entry,
  dashboardPages,
  onAddNativeCard,
  onNavigateToDashboardPage,
  favorites,
}: AddWidgetModalNativePanelProps) => {
  const { t } = useTranslation();
  const [selectedVariants, setSelectedVariants] = useState<Record<string, WidgetSizeIconVariant>>({});

  // Detect the placed WIDGET card by its own grid id (`widgetGridId`, distinct
  // from the favourite/identity `gridId` for coexistence entries like chat).
  const widgetGridId = entry.widgetGridId ?? entry.gridId;
  const dashboardPlacement = useMemo(
    () => dashboardLayoutService.findCardPlacementById(dashboardPages, widgetGridId),
    [dashboardPages, widgetGridId],
  );

  const isWidgetAlreadyOnDashboard = dashboardPlacement !== null;

  // Render exactly the card the entry declares — keyed by its grid id — instead
  // of branching on hardcoded native kinds. A new addable feature works without
  // touching this panel.
  const widgetCards = useMemo<WidgetCardDefinition[]>(
    () => [{ id: entry.gridId, ...entry.widgetCard }],
    [entry.gridId, entry.widgetCard],
  );

  useEffect(() => {
    const targetCardId = widgetCards[0]?.id;
    if (!targetCardId) return;

    if (dashboardPlacement) {
      setSelectedVariants({
        [targetCardId]: dashboardLayoutService.getVariantFromGridSize(dashboardPlacement.w, dashboardPlacement.h),
      });
      return;
    }

    setSelectedVariants({ [targetCardId]: widgetCards[0]?.sizeVariants[0] ?? 'small' });
  }, [dashboardPlacement, widgetCards]);

  const showSuccessToastWithView = useWidgetAddedToast(onNavigateToDashboardPage);

  const showFavorites = entry.supportsFavorites === true && favorites !== undefined;
  const isInFavorites = favorites?.ids.has(entry.gridId) ?? false;

  const handleAddToFavorites = async () => {
    if (isInFavorites) return;

    const outcome = await favorites!.onAdd(entry);
    if (!outcome.ok) {
      toast.error({ title: t('feature.dashboard.addWidget.toast.favoritesAddFailed') });
      return;
    }

    showSuccessToastWithView(
      t('feature.dashboard.addWidget.toast.addedToFavorites', { productName: t(entry.displayNameKey) }),
      outcome.pageIndex,
    );
  };

  const handleOpenWidget = () => {
    if (!dashboardPlacement) return;
    onNavigateToDashboardPage(dashboardPlacement.pageIndex);
  };

  const handleAddWidget = async (cardId: string) => {
    const variant = selectedVariants[cardId];
    if (!variant) return;

    const outcome = await onAddNativeCard(entry, WIDGET_SIZE_CONFIG[variant].size);
    if (!outcome.ok) {
      toast.error({ title: t('feature.dashboard.addWidget.toast.widgetAddFailed') });
      return;
    }

    const card = widgetCards.find(c => c.id === cardId);
    if (!card) return;

    showSuccessToastWithView(
      t('feature.dashboard.addWidget.toast.widgetAddedProduct', {
        widgetTitle: t(card.titleKey),
        sizeLabel: t(WIDGET_SIZE_CONFIG[variant].labelKey).toLowerCase(),
      }),
      outcome.pageIndex,
    );
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg-surface-container">
      <ProductDialogHeader
        name={t(entry.displayNameKey)}
        description={entry.descriptionKey ? t(entry.descriptionKey) : undefined}
        icon={entry.icon}
      />

      {showFavorites && (
        <div className="flex shrink-0 justify-start pt-8 pb-4">
          <AddWidgetFavoritesButton isInFavorites={isInFavorites} onAdd={handleAddToFavorites} />
        </div>
      )}

      <div className={cnTw('min-h-0 flex-1 overflow-hidden', showFavorites ? 'pt-4' : 'pt-8')}>
        <ScrollArea>
          <div className="flex flex-col gap-4">
            {widgetCards.map(card => {
              const selectedVariant = selectedVariants[card.id] ?? card.sizeVariants[0] ?? 'small';

              return (
                <AddWidgetModalCard
                  key={card.id}
                  card={card}
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
