import { type ReactNode } from 'react';
import { FormattedMessage } from 'react-intl';

import { Slot, useTransformer } from '@/shared/di';
import { cnTw } from '@/shared/utils';
import { type DashboardCard } from '@/domains/application';
import { dashboardCardActionsSlot, dashboardCardLayoutTransformer, dashboardCardMetadataTransformer } from '../di';
import { type WidgetSize } from '../types';

import { WidgetMenu } from './WidgetMenu';

const WIDGET_TOPBAR_MENU_OPEN_CLASS = 'widget-topbar-menu-open';

type Props = {
  card: DashboardCard;
  width: number;
  height: number;
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
  isMenuOpen,
  onMenuOpenChange,
  onResizeCard,
  onRemoveCard,
  onCleanupCards,
  children,
}: Props) => {
  const metadata = useTransformer(dashboardCardMetadataTransformer, card.payload);
  const layoutRules = useTransformer(dashboardCardLayoutTransformer, card.payload);
  const menuSizes = layoutRules?.menuSizes;

  return (
    <div
      className={cnTw(
        'group/widget relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-border-primary bg-bg-surface-container',
        isMenuOpen && WIDGET_TOPBAR_MENU_OPEN_CLASS,
      )}
    >
      <div className="shrink-0">
        <div className="widget-topbar-drag-handle flex w-full cursor-grab items-center gap-2 p-2 active:cursor-grabbing">
          {metadata?.icon ?? null}
          <span className="min-w-0 flex-1 truncate text-sm leading-5 font-semibold text-text-primary">
            {metadata?.label ?? null}
          </span>
          {menuSizes && menuSizes.length > 0 ? (
            <WidgetMenu
              sizes={menuSizes}
              currentSize={{ w: width, h: height }}
              removeLabel={metadata?.removeLabel ?? DEFAULT_REMOVE_LABEL}
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
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
};
