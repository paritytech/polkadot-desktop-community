import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

import { browserTabs } from '@/aggregates/browser-tabs';
import { CHAT } from '../tabs';

export const useOpenChatTab = () => {
  const navigate = useNavigate();

  return useCallback(() => {
    browserTabs.addTab({ id: CHAT, type: CHAT, deeplink: '' }, { persistable: true });
    browserTabs.selectTab(CHAT);
    void navigate({ to: '/chat/{-$chatId}' });
  }, [navigate]);
};
