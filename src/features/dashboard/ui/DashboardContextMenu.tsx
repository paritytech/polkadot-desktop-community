import { type MouseEvent, type PropsWithChildren } from 'react';

import { ContextMenu } from '@/shared/components';
import { Grid2x2PlusIcon16, LayoutDashboardIcon } from '@/shared/icons';
import { useTranslation } from '@/shared/translation';

type DashboardContextMenuProps = PropsWithChildren<{
  showCleanup: boolean;
  onAddWidget: () => void;
  onCleanup: () => void;
}>;

// Cards own their own menu — only the empty grid background opens this one.
// Preventing the event's default cancels the open: Radix composes our
// onContextMenu with checkForDefaultPrevented, so a prevented event skips its
// internal open handler.
const suppressOnCard = (event: MouseEvent<HTMLElement>) => {
  const target = event.target;
  if (target instanceof Element && target.closest('.react-grid-item')) {
    event.preventDefault();
  }
};

export const DashboardContextMenu = ({ children, showCleanup, onAddWidget, onCleanup }: DashboardContextMenuProps) => {
  const { t } = useTranslation();

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild onContextMenu={suppressOnCard}>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Content>
        <div className="w-52.5">
          <ContextMenu.Item onSelect={onAddWidget}>
            <Grid2x2PlusIcon16 className="size-4 -scale-y-100" />
            <span className="flex-1">{t('feature.dashboard.addWidget.title')}</span>
          </ContextMenu.Item>

          {showCleanup ? (
            <>
              <ContextMenu.Separator />

              <ContextMenu.Item onSelect={onCleanup}>
                <LayoutDashboardIcon className="size-4" />
                <span className="flex-1">{t('feature.dashboard.widgetMenu.cleanup')}</span>
              </ContextMenu.Item>
            </>
          ) : null}
        </div>
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
};
