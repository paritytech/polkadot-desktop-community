import { TabHoverTitle } from '@/shared/components';
import { useTranslation } from '@/shared/translation';

export const SettingsTabHover = () => {
  const { t } = useTranslation();
  return <TabHoverTitle title={t('feature.settings.title')} />;
};
