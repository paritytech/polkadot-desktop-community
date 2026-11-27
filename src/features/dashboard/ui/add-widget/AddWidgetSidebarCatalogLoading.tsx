import LoaderCircleIcon from '@/shared/assets/images/icons/loader-circle.svg?jsx';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';

type AddWidgetSidebarCatalogLoadingProps = {
  centered?: boolean;
};

export const AddWidgetSidebarCatalogLoading = ({ centered = false }: AddWidgetSidebarCatalogLoadingProps) => {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t('feature.dashboard.addWidget.loading')}
      className={cnTw('flex items-center gap-2 px-3 py-3 text-fg-secondary', centered && 'min-h-30 flex-1 justify-center py-8')}
    >
      <LoaderCircleIcon className="size-4 shrink-0 animate-spin" />
      <span className="text-sm">{t('feature.dashboard.addWidget.loading')}</span>
    </div>
  );
};
