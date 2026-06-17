import { useEffect, useRef } from 'react';

import { createNotificationService } from '../notificationService';

type UseNotificationServiceParams = {
  userId: string | null;
  getActiveChatId: () => string | null;
  navigateToChat: (sessionId: string) => void;
};

export const useNotificationService = ({ userId, getActiveChatId, navigateToChat }: UseNotificationServiceParams) => {
  const serviceRef = useRef<{ dispose: VoidFunction } | null>(null);
  // Latest-callback refs so the effect only re-runs on `userId` changes.
  // Without this, callers that rebuild `getActiveChatId`/`navigateToChat`
  // on every route navigation (the usual case — they close over
  // `location.pathname`) would dispose and re-create the service per
  // navigation, which previously also cleared the already-notified set
  // and caused a push-storm of OS notifications for still-unread messages.
  const getActiveChatIdRef = useRef(getActiveChatId);
  const navigateToChatRef = useRef(navigateToChat);
  getActiveChatIdRef.current = getActiveChatId;
  navigateToChatRef.current = navigateToChat;

  useEffect(() => {
    if (!userId) return;

    serviceRef.current = createNotificationService({
      userId,
      getActiveChatId: () => getActiveChatIdRef.current(),
      navigateToChat: sessionId => navigateToChatRef.current(sessionId),
    });

    return () => {
      serviceRef.current?.dispose();
      serviceRef.current = null;
    };
  }, [userId]);
};
