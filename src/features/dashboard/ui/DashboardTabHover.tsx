import { TabHoverTitle } from '@/shared/components';
import { useTranslation } from '@/shared/translation';

export const DashboardTabHover = () => {
  const { t } = useTranslation();
  return <TabHoverTitle title={t('feature.dashboard.title')} />;
};
