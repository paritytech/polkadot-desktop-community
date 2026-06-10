import { type PappAdapter } from '@novasamatech/host-papp';
import { useSession } from '@novasamatech/host-papp-react-ui';
import { AccountId } from '@polkadot-api/substrate-bindings';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useRead } from '@/shared/hooks';
import { lazyClient, loadDeviceIdentity, loadUserIdentity, statementStoreAdapter } from '@/domains/application';

import { createP2PChatManagerV2 } from './managerV2Factory';
import { useNotificationService } from './notificationHooks';
import { p2pRequestsResource, p2pRoomsResource } from './resource';
import { createP2PChatSession } from './session';
import { type P2PChatManager, type P2PChatRequest, type SearchResult } from './types';

const P2PChatManagerContext = createContext<P2PChatManager | null>(null);

/**
 * Provides a single shared P2P Chat Manager instance to the component tree.
 * The manager is created when the user is authenticated and disposed on logout.
 */
export const P2PChatManagerProvider = ({ pappProvider, children }: { pappProvider: PappAdapter | null; children: ReactNode }) => {
  const { session } = useSession();
  const [manager, setManager] = useState<P2PChatManager | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (!session || !pappProvider || initRef.current) return;
    initRef.current = true;
    let cancelled = false;

    const initManager = async () => {
      try {
        // The V2 pairing signal is the SDK-owned device + user identity, not the
        // session id surfaced by `useSession()`. The synthesized `v2:` session is
        // injected by `usePappProvider` only after it loads the device identity;
        // until then `useSession()` surfaces the base SDK session (a plain nanoid
        // id), so keying off `id.startsWith('v2:')` produced a spurious "Legacy
        // V1 session detected" error during that pre-wrap window. Gate on the
        // identity instead — it's readable from the SDK as soon as the pairing
        // persists, so P2P initialises on the first pass with no churn.
        const [device, userIdentity] = await Promise.all([loadDeviceIdentity(), loadUserIdentity()]);
        if (!device || !userIdentity) {
          // Not paired (or the SDK hasn't persisted the V2 session yet) — defer.
          // The effect re-runs when the session settles into the V2 identity.
          return;
        }

        // userId must be SS58(device.statementAccountPublicKey) to match the
        // V2 session's localAccount and the device-sync `ownUserId`, so synced
        // rooms land under the userId the chat list reads.
        const userId = AccountId().dec(device.statementAccountPublicKey);

        const mgr = await createP2PChatManagerV2({
          statementStore: statementStoreAdapter,
          lazyClient,
          userId,
          device,
          userIdentity,
        });

        await mgr.initialize();

        if (cancelled) {
          mgr.dispose();
          return;
        }

        setManager(mgr);
      } catch (e) {
        console.error('[p2p-hooks] Failed to initialize P2P chat manager:', e);
      }
    };

    void initManager();

    return () => {
      cancelled = true;
      setManager(prev => {
        prev?.dispose();

        return null;
      });
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

  return <P2PChatManagerContext.Provider value={manager}>{children}</P2PChatManagerContext.Provider>;
};

/**
 * Returns the shared P2P Chat Manager from context.
 * Must be used within a P2PChatManagerProvider.
 */
export const useP2PChatManager = (): P2PChatManager | null => {
  return useContext(P2PChatManagerContext);
};

/**
 * Returns P2P chat sessions as ChatSession[] (Observable-based).
 */
export const useP2PSessions = () => {
  const { session } = useSession();
  const manager = useP2PChatManager();

  const userId = useMemo(() => {
    if (!session) return null;

    return AccountId().dec(session.localAccount.accountId);
  }, [session]);

  const {
    data: rooms,
    pending: pendingRooms,
    error,
  } = useRead(p2pRoomsResource, {
    params: userId ? { userId } : null,
    defaultValue: [],
    map: (cache, { userId: uid }) => cache[uid],
  });

  const sessions = useMemo(() => {
    if (!manager || !rooms) return [];

    return rooms.map(room =>
      createP2PChatSession({ type: 'p2p', accountId: room.peerId, name: room.peerUsername }, room, manager),
    );
  }, [manager, rooms]);

  return { data: sessions, pending: pendingRooms, error };
};

/**
 * Returns pending P2P chat requests.
 */
export const useP2PRequests = () => {
  const { session } = useSession();

  const userId = useMemo(() => {
    if (!session) return null;

    return AccountId().dec(session.localAccount.accountId);
  }, [session]);

  const { data: requests, pending: pendingRequests } = useRead(p2pRequestsResource, {
    params: userId ? { userId } : null,
    defaultValue: [],
    map: (cache, { userId: uid }) => cache[uid],
  });

  const pendingIncoming = useMemo(
    () => requests.filter((r: P2PChatRequest) => r.direction === 'incoming' && r.status === 'pending'),
    [requests],
  );

  const pendingOutgoing = useMemo(
    () => requests.filter((r: P2PChatRequest) => r.direction === 'outgoing' && r.status === 'pending'),
    [requests],
  );

  return { data: pendingIncoming, outgoing: pendingOutgoing, pending: pendingRequests };
};

/**
 * Contact search hook with debouncing.
 */
export const useContactSearch = () => {
  const manager = useP2PChatManager();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pending, setPending] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    (query: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSearchError(null);

      if (!query.trim() || !manager) {
        setResults([]);
        setPending(false);

        return;
      }

      setPending(true);
      debounceRef.current = setTimeout(() => {
        manager
          .searchPeers(query)
          .then(setResults)
          .catch((e: unknown) => {
            setResults([]);
            setSearchError(e instanceof Error ? e.message : 'Search failed');
          })
          .finally(() => setPending(false));
      }, 300);
    },
    [manager],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { search, results, pending, searchError };
};

/**
 * Returns a stable function to accept an incoming P2P chat request.
 */
export const useAcceptRequest = () => {
  const manager = useP2PChatManager();
  return useCallback(
    async (requestId: string) => {
      if (!manager) throw new Error('P2P chat manager not initialized');
      await manager.acceptRequest(requestId);
    },
    [manager],
  );
};

/**
 * Returns a stable function to decline an incoming P2P chat request.
 */
export const useDeclineRequest = () => {
  const manager = useP2PChatManager();
  return useCallback(
    async (requestId: string) => {
      if (!manager) throw new Error('P2P chat manager not initialized');
      await manager.declineRequest(requestId);
    },
    [manager],
  );
};

/**
 * Returns a stable function to send a P2P chat request to a peer.
 */
export const useSendChatRequest = () => {
  const manager = useP2PChatManager();
  return useCallback(
    async (peerAccountId: string, peerUsername: string, welcomeMessage?: string) => {
      if (!manager) throw new Error('P2P chat manager not initialized');
      await manager.sendRequest(peerAccountId, peerUsername, welcomeMessage);
    },
    [manager],
  );
};

/**
 * Returns a stable function to cancel a pending outgoing P2P chat request.
 */
export const useCancelOutgoingRequest = () => {
  const manager = useP2PChatManager();
  return useCallback(
    async (requestId: string, peerId: string) => {
      if (!manager) throw new Error('P2P chat manager not initialized');
      await manager.cancelOutgoingRequest(requestId, peerId);
    },
    [manager],
  );
};
