import MessagesSquareIcon from '@/shared/assets/images/icons/messages-square.svg?jsx';
import { ListItem } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';

import { UnreadCount } from './UnreadCount';

type NewRequestsItemProps = {
  count: number;
  subtitle: string;
  onClick: VoidFunction;
};

export const NewRequestsItem = ({ count, subtitle, onClick }: NewRequestsItemProps) => {
  const { t } = useTranslation();

  return (
    <ListItem
      icon={<MessagesSquareIcon />}
      label={t('feature.chat.request.entryTitle')}
      description={subtitle.length > 0 ? <span>{subtitle}</span> : null}
      meta={<UnreadCount count={count} />}
      testId={TEST_IDS.chatNewRequestsItem}
      onClick={onClick}
    />
  );
};
