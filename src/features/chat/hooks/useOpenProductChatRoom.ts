import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

import { browserTabs } from '@/aggregates/browser-tabs';
import { CHAT } from '../tabs';

export const useOpenProductChatRoom = () => {
  const navigate = useNavigate();

  return useCallback(
    (sessionId: string) => {
      browserTabs.addTab({ id: CHAT, type: CHAT, deeplink: '' }, { persistable: true });
      browserTabs.selectTab(CHAT);
      void navigate({ to: '/chat/{-$chatId}', params: { chatId: sessionId } });
    },
    [navigate],
  );
};
