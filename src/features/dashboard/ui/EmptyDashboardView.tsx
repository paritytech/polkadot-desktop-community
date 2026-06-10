import { Button } from '@novasamatech/tr-ui';

import AddToDashboardIcon from '@/shared/assets/images/add-to-dashboard.svg?jsx';
import LogoIcon from '@/shared/assets/images/logo.svg?jsx';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';

const addWidgetMenuIconClassName = 'h-[11px] w-[10.7px] shrink-0 -scale-y-100 text-fg-primary';

type EmptyDashboardViewProps = {
  onAddWidget: () => void;
};

export const EmptyDashboardView = ({ onAddWidget }: EmptyDashboardViewProps) => {
  const { t } = useTranslation();
  const addWidgetLabel = t('feature.dashboard.addWidget.title');

  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-bg-surface-main px-6">
      <section className="flex w-full max-w-[356px] flex-col items-center rounded-xl p-10 text-center">
        <LogoIcon className="mb-2 h-auto w-[280px] text-fg-primary" aria-hidden />

        <div className="mb-6 flex w-full flex-col items-center gap-1">
          <p className="text-body-l-medium text-fg-primary">{t('feature.dashboard.empty.title')}</p>
          <p className="text-body-m-regular text-fg-secondary">{t('feature.dashboard.empty.description')}</p>
        </div>

        <Button type="button" variant="default" size="sm" aria-label={addWidgetLabel} onClick={onAddWidget}>
          <AddToDashboardIcon className={cnTw(addWidgetMenuIconClassName, 'text-fg-primary-inverted')} aria-hidden />
          <span>{addWidgetLabel}</span>
        </Button>
      </section>
    </div>
  );
};
