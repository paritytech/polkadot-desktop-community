import ChatBubbleIcon from '@/shared/assets/images/header/chat-bubble.svg?jsx';
import { TabChip } from '@/shared/components';
import { useTranslation } from '@/shared/translation';

type Props = { isActive: boolean };

export const ChatTabContent = ({ isActive }: Props) => {
  const { t } = useTranslation();
  return <TabChip icon={<ChatBubbleIcon aria-hidden />} isActive={isActive} label={t('feature.chat.title')} />;
};
