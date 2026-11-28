import { TabChip } from '@/shared/components';
import { MessageCircleIcon16 } from '@/shared/icons';
import { useTranslation } from '@/shared/translation';

type Props = { isActive: boolean };

export const ChatTabContent = ({ isActive }: Props) => {
  const { t } = useTranslation();
  return <TabChip icon={<MessageCircleIcon16 />} isActive={isActive} label={t('feature.chat.title')} />;
};
