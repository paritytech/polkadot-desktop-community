import { type PappAdapter } from '@novasamatech/host-papp';
import { useSession } from '@novasamatech/host-papp-react-ui';
import { AccountId } from '@polkadot-api/substrate-bindings';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useNotificationService } from '@/domains/chat';
import { p2pChatUseCase } from '../p2pChatUseCase';

/**
 * Headless binding that drives the P2P chat manager's lifecycle from the React
 * tree (the aggregate's one allowed UI carve-out — it renders nothing).
 *
 * The manager is created when the user is authenticated and disposed on logout;
 * the binding also wires OS notifications, which need React-only inputs (the
 * router-derived active chat id + navigation) that can't live in the use case.
 */
export const P2PChatBinding = ({ pappProvider }: { pappProvider: PappAdapter | null }): null => {
  const { session } = useSession();
  const initRef = useRef(false);

  useEffect(() => {
    if (!session || !pappProvider || initRef.current) return;
    initRef.current = true;

    void p2pChatUseCase.initialize();

    return () => {
      p2pChatUseCase.dispose();
      initRef.current = false;
    };
  }, [session, pappProvider]);

  const location = useLocation();
  const navigate = useNavigate();

  const notificationUserId = useMemo(() => {
    if (!session) return null;

    return AccountId().dec(session.localAccount.accountId);
  }, [session]);

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
