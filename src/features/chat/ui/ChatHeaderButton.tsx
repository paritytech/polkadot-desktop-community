import { useMemo, useState } from 'react';

import ChatBubbleIcon from '@/shared/assets/images/header/chat-bubble.svg?jsx';
import { IconButton } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { useProductSessions, useTotalUnreadCount } from '@/domains/chat';
import { useP2PSessions } from '@/aggregates/p2p-chat';
import { useTruapiUserId } from '@/aggregates/truapi-runtime';

import { QuickChat } from './QuickChat';

export const ChatHeaderButton = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const userId = useTruapiUserId();
  const { data: productSessions } = useProductSessions(userId);
  const { data: p2pSessions } = useP2PSessions();
  const sessions = useMemo(() => [...productSessions, ...p2pSessions], [productSessions, p2pSessions]);
  const totalUnread = useTotalUnreadCount(sessions);

  return (
    <QuickChat open={isOpen} onOpenChange={setIsOpen}>
      {/* The dot needs `role` for its own label to apply at all — `aria-label` on a bare span is ignored. */}
      <IconButton label={t('feature.chat.quickChat')} data-testid={TEST_IDS.quickChatButton}>
        <ChatBubbleIcon className="size-4" aria-hidden />
        {totalUnread > 0 && (
          <span
            role="status"
            aria-label={t('feature.chat.unreadMessagesAria')}
            className="absolute end-1.5 top-1.5 block size-1.5 rounded-full bg-chrome-ok"
          />
        )}
      </IconButton>
    </QuickChat>
  );
};
