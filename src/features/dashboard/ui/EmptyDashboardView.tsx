import AddToDashboardIcon from '@/shared/assets/images/add-to-dashboard.svg?jsx';
import LogoIcon from '@/shared/assets/images/logo.svg?jsx';
import { Button } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';

type EmptyDashboardViewProps = {
  onAddWidget: () => void;
};

export const EmptyDashboardView = ({ onAddWidget }: EmptyDashboardViewProps) => {
  const { t } = useTranslation();
  const addWidgetLabel = t('feature.dashboard.addWidget.title');

  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-bg-surface-main px-6">
      <section
        data-testid={TEST_IDS.dashboardEmptyState}
        className="flex w-full max-w-89 flex-col items-center rounded-xl p-10 text-center"
      >
        <LogoIcon className="mb-2 h-auto w-70 text-fg-primary" aria-hidden />

        <div className="mb-6 flex w-full flex-col items-center gap-1">
          <p className="text-body-large-emphasized text-fg-primary">{t('feature.dashboard.empty.title')}</p>
          <p className="text-body-medium text-fg-secondary">{t('feature.dashboard.empty.description')}</p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          aria-label={addWidgetLabel}
          data-testid={TEST_IDS.dashboardEmptyStateAddWidget}
          onClick={onAddWidget}
        >
          <AddToDashboardIcon className="size-2.75 shrink-0 -scale-y-100" aria-hidden />
          <span>{addWidgetLabel}</span>
        </Button>
      </section>
    </div>
  );
};
