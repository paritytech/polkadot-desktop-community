import { useLocation, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect } from 'react';

import { useNotificationService } from '@/domains/chat';
import { useTruapiAuthState } from '@/aggregates/truapi-runtime';
import { useP2PChatUserId } from '../hooks';
import { p2pChatUseCase } from '../p2pChatUseCase';

/**
 * Headless binding that drives the P2P chat manager's lifecycle from the React
 * tree (the aggregate's one allowed UI carve-out — it renders nothing).
 *
 * `initialize` runs on every transition into `Connected` rather than once on mount:
 * the core reports the session about a second after this mounts, so a mount-once
 * call finds no identity, returns, and is never asked again. `initialize` is
 * idempotent against an existing manager and an in-flight call, so re-running on a
 * later transition is free. `dispose` stays on unmount.
 *
 * It also wires OS notifications, which need React-only inputs (the router-derived
 * active chat id + navigation) that cannot live in the use case.
 */
export const P2PChatBinding = (): null => {
  const authState = useTruapiAuthState();
  const authTag = authState?.tag;

  useEffect(() => {
    if (authTag !== 'Connected') return;

    void p2pChatUseCase.initialize();
  }, [authTag]);

  useEffect(() => {
    return () => {
      p2pChatUseCase.dispose();
    };
  }, []);

  const location = useLocation();
  const navigate = useNavigate();

  // Must equal the P2P rooms' `userId`, or notifications resolve against a room set
  // nothing else writes.
  const notificationUserId = useP2PChatUserId();

  const getActiveChatId = useCallback(() => {
    const match = location.pathname.match(/^\/chat\/(.+)/);

    return match?.[1] ?? null;
  }, [location.pathname]);

  const navigateToChat = useCallback(
    (sessionId: string) => {
      void navigate({ to: '/chat/{-$chatId}', params: { chatId: sessionId } });
    },
    [navigate],
  );

  useNotificationService({
    userId: notificationUserId,
    getActiveChatId,
    navigateToChat,
  });

  return null;
};
