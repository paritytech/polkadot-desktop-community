import { toast, toastSuccess } from '@novasamatech/tr-ui';

import { useTranslation } from '@/shared/translation';

/**
 * Success toast shared by the add-widget panels. When the widget lands on a
 * known dashboard page, the toast offers a "View" action that navigates there;
 * otherwise it falls back to a plain success toast.
 */
export const useWidgetAddedToast = (onNavigateToDashboardPage: (pageIndex: number) => void) => {
  const { t } = useTranslation();

  return (title: string, pageIndex?: number) => {
    if (pageIndex === undefined) {
      toastSuccess({ title });
      return;
    }

    toast.success(title, {
      action: {
        label: t('feature.dashboard.addWidget.toast.viewAction'),
        onClick: () => onNavigateToDashboardPage(pageIndex),
      },
    });
  };
};
