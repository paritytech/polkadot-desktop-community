import Grid2x2PlusIcon from '@/shared/assets/images/icons/grid-2x2-plus.svg?jsx';
import { Button } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';

type DashboardToolbarProps = {
  pageCount: number;
  activePageIndex: number;
  onSelectPage: (index: number) => void;
  onAddWidget: () => void;
};

export const DashboardToolbar = ({ pageCount, activePageIndex, onSelectPage, onAddWidget }: DashboardToolbarProps) => {
  const { t } = useTranslation();
  const addWidgetLabel = t('feature.dashboard.addWidget.title');
  const pagesLabel = t('feature.dashboard.toolbar.pagesLabel');

  const showPagination = pageCount > 1;

  return (
    <div
      className="flex w-full shrink-0 items-center justify-between gap-4 px-2 pb-2"
      role="toolbar"
      aria-label={t('feature.dashboard.toolbar.ariaLabel')}
    >
      <div className="flex shrink-0 items-center">
        {showPagination ? (
          <div className="flex items-center gap-1 px-1" role="tablist" aria-label={pagesLabel}>
            {Array.from({ length: pageCount }).map((_, index) => {
              const isActive = index === activePageIndex;
              return (
                <button
                  // eslint-disable-next-line react/no-array-index-key
                  key={index}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={t('feature.dashboard.toolbar.switchToPage', { number: index + 1 })}
                  data-testid={TEST_IDS.dashboardPaginationTab}
                  className={
                    isActive
                      ? 'h-2 w-4 shrink-0 rounded-full bg-bg-action-primary transition-[width,background-color] duration-200'
                      : 'size-2 shrink-0 rounded-full bg-bg-action-tertiary transition-[width,background-color] duration-200 hover:bg-fg-tertiary'
                  }
                  onClick={() => onSelectPage(index)}
                />
              );
            })}
          </div>
        ) : null}
      </div>

      <Button
        type="button"
        size="sm"
        aria-label={addWidgetLabel}
        data-testid={TEST_IDS.dashboardAddWidgetButton}
        onClick={onAddWidget}
      >
        <Grid2x2PlusIcon className="size-2.75 shrink-0 -scale-y-100" />
        <span>{addWidgetLabel}</span>
      </Button>
    </div>
  );
};
