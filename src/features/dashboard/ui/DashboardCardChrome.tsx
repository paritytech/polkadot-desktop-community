import { type ReactNode } from 'react';
import { FormattedMessage } from 'react-intl';

import { GRID_COLS } from '@/shared/components';
import { Slot, useTransformer } from '@/shared/di';
import { cnTw } from '@/shared/utils';
import { type DashboardCard, type DashboardCardLayoutRules, dashboardLayoutService } from '@/domains/application';
import { dashboardCardActionsSlot, dashboardCardMenuItemsSlot, dashboardCardMetadataTransformer } from '../di';
import { type WidgetSize } from '../types';

import { WidgetMenu } from './WidgetMenu';

const WIDGET_TOPBAR_MENU_OPEN_CLASS = 'widget-topbar-menu-open';

type Props = {
  card: DashboardCard;
  width: number;
  height: number;
  // Layout rules for this card, supplied by the card feature that renders the
  // chrome. `null` hides the size menu (the card declares no switchable sizes).
  layoutRules: DashboardCardLayoutRules | null;
  // E2E hook identifying the concrete card kind rendering this chrome (e.g. a
  // product widget vs the favorites folder). Optional — chrome is kind-agnostic.
  testId?: string;
  // When true, the whole block pulses (loading skeleton). The per-column
  // animation-delay creates a left-to-right wave across the grid.
  isLoading?: boolean;
  isMenuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  onResizeCard: (size: WidgetSize) => void;
  onRemoveCard: () => void;
  onCleanupCards?: VoidFunction;
  children: ReactNode;
};

const DEFAULT_REMOVE_LABEL = <FormattedMessage id="feature.dashboard.widgetMenu.removeWidget" />;

export const DashboardCardChrome = ({
  card,
  width,
  height,
  layoutRules,
  testId,
  isLoading,
  isMenuOpen,
  onMenuOpenChange,
  onResizeCard,
  onRemoveCard,
  onCleanupCards,
  children,
}: Props) => {
  const metadata = useTransformer(dashboardCardMetadataTransformer, card.payload);
  // A size-locked card (invalid manifest, already placed) shows only its current
  // size; otherwise show the manifest-declared sizes.
  const isSizeLocked = layoutRules?.lockSizeToCurrent ?? false;
  const switchableSizes = isSizeLocked
    ? [dashboardLayoutService.getVariantFromGridSize(width, height)]
    : layoutRules?.switchableSizes;

  return (
    <div
      data-testid={testId}
      className={cnTw(
        'group/widget relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-stroke-primary bg-bg-surface-container',
        isMenuOpen && WIDGET_TOPBAR_MENU_OPEN_CLASS,
        isLoading && 'animate-widget-pulse',
      )}
      style={isLoading ? { animationDelay: `${(card.x % GRID_COLS) * 200}ms` } : undefined}
    >
      <div className="shrink-0">
        <div className="widget-topbar-drag-handle flex w-full cursor-grab items-center gap-2 p-2 active:cursor-grabbing">
          {metadata?.icon ?? null}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg-primary">{metadata?.label ?? null}</span>
          {switchableSizes && switchableSizes.length > 0 ? (
            <WidgetMenu
              sizes={switchableSizes}
              currentSize={{ w: width, h: height }}
              isSizeLocked={isSizeLocked}
              removeLabel={metadata?.removeLabel ?? DEFAULT_REMOVE_LABEL}
              menuItems={<Slot id={dashboardCardMenuItemsSlot} props={{ payload: card.payload }} />}
              isOpen={isMenuOpen}
              onResize={onResizeCard}
              onCleanup={onCleanupCards}
              onRemove={onRemoveCard}
              onOpenChange={onMenuOpenChange}
            />
          ) : null}
          <Slot id={dashboardCardActionsSlot} props={{ payload: card.payload }} />
        </div>
      </div>
      <div className={cnTw('min-h-0 flex-1 overflow-hidden', !isLoading && 'duration-500 animate-in fade-in')}>{children}</div>
    </div>
  );
};
