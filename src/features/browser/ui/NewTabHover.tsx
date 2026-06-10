import { TabHoverTitle } from '@/shared/components';
import { useTranslation } from '@/shared/translation';

export const NewTabHover = () => {
  const { t } = useTranslation();
  return <TabHoverTitle title={t('feature.browser.newTab')} />;
};
