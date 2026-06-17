import { ScrollArea, toast } from '@novasamatech/tr-ui';
import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/shared/translation';
import { type DashboardCard, type WidgetSizeIconVariant, dashboardLayoutService } from '@/domains/application';
import { ProductDialogHeader } from '@/widgets/ProductDialogHeader';
import { WIDGET_SIZE_CONFIG } from '../../constants';
import { type AddableDashboardCard } from '../../di';

import { findNativeDashboardPlacement } from './addWidgetList';
import { useWidgetAddedToast } from './useWidgetAddedToast';
import { type WidgetCardDefinition } from './widgetModalConstants';
import { AddWidgetModalCard } from './widgetModalParts';

export type AddWidgetModalNativePanelProps = {
  entry: AddableDashboardCard;
  dashboardPages: DashboardCard[][];
  onAddNativeCard: (entry: AddableDashboardCard, size: { w: number; h: number }) => Promise<{ ok: boolean; pageIndex?: number }>;
  onNavigateToDashboardPage: (pageIndex: number) => void;
};

export const AddWidgetModalNativePanel = ({
  entry,
  dashboardPages,
  onAddNativeCard,
  onNavigateToDashboardPage,
}: AddWidgetModalNativePanelProps) => {
  const { t } = useTranslation();
  const [selectedVariants, setSelectedVariants] = useState<Record<string, WidgetSizeIconVariant>>({});

  const dashboardPlacement = useMemo(() => findNativeDashboardPlacement(dashboardPages, entry), [dashboardPages, entry]);

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

  const handleOpenWidget = () => {
    if (!dashboardPlacement) return;
    onNavigateToDashboardPage(dashboardPlacement.pageIndex);
  };

  const handleAddWidget = async (cardId: string) => {
    const variant = selectedVariants[cardId];
    if (!variant) return;

    const outcome = await onAddNativeCard(entry, WIDGET_SIZE_CONFIG[variant].size);
    if (!outcome.ok) {
      toast.error(t('feature.dashboard.addWidget.toast.widgetAddFailed'));
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

      <div className="min-h-0 flex-1 overflow-hidden pt-8">
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
