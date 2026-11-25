import { useMemo } from 'react';

import { useRead } from '@/shared/hooks';

import { p2pRequestsResource, p2pRoomsResource } from './resource';
import { p2pService } from './service';
import { type P2PRoom } from './types';

/**
 * Pure-resource reads over the P2P chat tables. Manager-dependent hooks
 * (sessions, contact search, request actions) and the manager lifecycle live
 * in the `p2p-chat` aggregate — the domain owns the data layer, not the
 * runtime manager.
 *
 * `userId` is SS58 of this device's statement account, the id the rooms are keyed
 * by; `null` reads nothing.
 */

/**
 * Live P2P rooms for the signed-in user.
 */
export const useP2PRooms = (userId: string | null): { data: P2PRoom[]; pending: boolean; error: unknown } => {
  return useRead(p2pRoomsResource, {
    params: userId ? { userId } : null,
    defaultValue: [],
    map: (cache, { userId: uid }) => cache[uid],
  });
};

/**
 * Returns three lists of P2P chat requests: `data` (pending incoming), `outgoing` (pending outgoing) and
 * `cancelledIncoming` (incoming requests the sender cancelled).
 */
export const useP2PRequests = (userId: string | null) => {
  const { data: requests, pending: pendingRequests } = useRead(p2pRequestsResource, {
    params: userId ? { userId } : null,
    defaultValue: [],
    map: (cache, { userId: uid }) => cache[uid],
  });

  const pendingIncoming = useMemo(() => requests.filter(p2pService.isPendingIncomingRequest), [requests]);

  const pendingOutgoing = useMemo(() => requests.filter(p2pService.isPendingOutgoingRequest), [requests]);

  const cancelledIncoming = useMemo(() => requests.filter(p2pService.isCancelledIncomingRequest), [requests]);

  return { data: pendingIncoming, outgoing: pendingOutgoing, cancelledIncoming, pending: pendingRequests };
};
