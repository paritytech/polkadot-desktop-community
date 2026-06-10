import { useLocation } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import ChatBubbleIcon from '@/shared/assets/images/header/chat-bubble.svg?jsx';
import { HeaderButton, iconBase } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { useP2PSessions, useProductSessions, useTotalUnreadCount } from '@/domains/chat';

import { QuickChat } from './QuickChat';

const chatIconClassName = `size-4 ${iconBase}`;

export const ChatHeaderButton = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const isChatRoute = location.pathname.startsWith('/chat');

  const { data: productSessions } = useProductSessions();
  const { data: p2pSessions } = useP2PSessions();
  const sessions = useMemo(() => [...productSessions, ...p2pSessions], [productSessions, p2pSessions]);
  const totalUnread = useTotalUnreadCount(sessions);

  return (
    <div className="inline-flex items-center" data-testid={TEST_IDS.quickChatButton}>
      <QuickChat open={isOpen} onOpenChange={setIsOpen}>
        <HeaderButton variant="icon" active={isOpen || isChatRoute}>
          <ChatBubbleIcon className={chatIconClassName} aria-hidden />
          {totalUnread > 0 && (
            <span
              aria-label={t('feature.chat.unreadMessagesAria')}
              className="absolute top-[5px] right-[5px] block size-2.5 rounded-full border border-bg-surface-container bg-fg-success"
            />
          )}
        </HeaderButton>
      </QuickChat>
    </div>
  );
};
