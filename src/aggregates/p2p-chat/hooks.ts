import { useCallback, useMemo } from 'react';

import { useRxState } from '@/shared/rxstate';
import { type ChatSession, type P2PChatManager, type SearchResult, createP2PChatSession, useP2PRooms } from '@/domains/chat';

import { p2pChatManager$ } from './state/manager';

/**
 * The live P2P chat manager, or `null` while chat isn't running. Manager-bound
 * action hooks below read it from this single selector.
 */
export const useP2PChatManager = () => {
  const [manager] = useRxState(p2pChatManager$);

  return manager;
};

const requireManager = (manager: P2PChatManager | null): P2PChatManager => {
  if (!manager) throw new Error('P2P chat manager not initialized');

  return manager;
};

/**
 * P2P chat sessions as `ChatSession[]` (Observable-based), one per room.
 */
export const useP2PSessions = (): { data: ChatSession[]; pending: boolean; error: unknown } => {
  const manager = useP2PChatManager();
  const { data: rooms, pending, error } = useP2PRooms();

  const sessions = useMemo(() => {
    if (!manager) return [];

    return rooms.map(room =>
      createP2PChatSession({ type: 'p2p', accountId: room.peerId, name: room.peerUsername }, room, manager),
    );
  }, [manager, rooms]);

  return { data: sessions, pending, error };
};

/**
 * Manager-bound peer search. Returns a stable `searchPeers` that resolves the
 * domain results (or `[]` when chat isn't running), plus `ready` so callers can
 * gate UI. Debounce and result/pending/error state are UI concerns and live in
 * the consuming feature (`features/chat/hooks/useContactSearch`), not here.
 */
export const useSearchPeers = (): { searchPeers: (query: string) => Promise<SearchResult[]>; ready: boolean } => {
  const manager = useP2PChatManager();

  const searchPeers = useCallback(
    async (query: string): Promise<SearchResult[]> => {
      if (!manager) return [];

      return manager.searchPeers(query);
    },
    [manager],
  );

  return { searchPeers, ready: manager !== null };
};

/**
 * Returns a stable function to accept an incoming P2P chat request.
 */
export const useAcceptRequest = () => {
  const manager = useP2PChatManager();
  return useCallback(async (requestId: string) => requireManager(manager).acceptRequest(requestId), [manager]);
};

/**
 * Returns a stable function to decline an incoming P2P chat request.
 */
export const useDeclineRequest = () => {
  const manager = useP2PChatManager();
  return useCallback(async (requestId: string) => requireManager(manager).declineRequest(requestId), [manager]);
};

/**
 * Returns a stable function to send a P2P chat request to a peer.
 */
export const useSendChatRequest = () => {
  const manager = useP2PChatManager();
  return useCallback(
    async (peerAccountId: string, peerUsername: string, welcomeMessage?: string) =>
      requireManager(manager).sendRequest(peerAccountId, peerUsername, welcomeMessage),
    [manager],
  );
};

/**
 * Returns a stable function to cancel a pending outgoing P2P chat request.
 */
export const useCancelOutgoingRequest = () => {
  const manager = useP2PChatManager();
  return useCallback(
    async (requestId: string, peerId: string) => requireManager(manager).cancelOutgoingRequest(requestId, peerId),
    [manager],
  );
};
