import { TabHoverTitle } from '@/shared/components';
import { useTranslation } from '@/shared/translation';

export const ChatTabHover = () => {
  const { t } = useTranslation();
  return <TabHoverTitle title={t('feature.chat.title')} />;
};
