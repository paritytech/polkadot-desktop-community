import { TabChip } from '@/shared/components';
import { MessageCircleIcon } from '@/shared/icons';
import { useTranslation } from '@/shared/translation';

type Props = { isActive: boolean };

export const ChatTabContent = ({ isActive }: Props) => {
  const { t } = useTranslation();
  return <TabChip icon={<MessageCircleIcon />} isActive={isActive} label={t('feature.chat.title')} />;
};
