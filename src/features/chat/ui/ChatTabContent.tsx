import MessageCircleIcon from '@/shared/assets/images/icons/message-circle.svg?jsx';
import { TabChip } from '@/shared/components';
import { useTranslation } from '@/shared/translation';

type Props = { isActive: boolean };

export const ChatTabContent = ({ isActive }: Props) => {
  const { t } = useTranslation();
  return <TabChip icon={<MessageCircleIcon />} isActive={isActive} label={t('feature.chat.title')} />;
};
