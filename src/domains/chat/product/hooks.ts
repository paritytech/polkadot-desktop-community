import { useSession, useSessionIdentity } from '@novasamatech/host-papp-react-ui';
import { useMemo } from 'react';
import { useObservable } from 'react-rx';

import { useAction, useRead } from '@/shared/hooks';
import { type UserPeer } from '../session/types';

import { declaredProductRooms$ } from './declared-rooms';
import { createProductRoom, roomsResource } from './resource';
import { productChatService } from './service';
import { createProductChatSession } from './session';

// function formatDate(timestamp: number): string {
//   const date = new Date(timestamp);
//   const today = new Date();
//   const yesterday = new Date(today);
//   yesterday.setDate(yesterday.getDate() - 1);
//
//   if (date.toDateString() === today.toDateString()) {
//     return 'Today';
//   } else if (date.toDateString() === yesterday.toDateString()) {
//     return 'Yesterday';
//   } else {
//     return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
//   }
// }

export const useCurrentUserPeer = () => {
  const { session } = useSession();
  const [identity, pendingIdentity] = useSessionIdentity(session);
  const peer = useMemo((): UserPeer | null => {
    if (!session) return null;

    return {
      type: 'user',
      accountId: productChatService.getUserId(session),
      name: identity?.fullUsername ?? identity?.liteUsername ?? '',
    };
  }, [session, identity]);

  return { data: peer, pending: pendingIdentity };
};

// The current user's product chat rooms (across all products), live from the DB.
const useUserRooms = () => {
  const { data: peer, pending: pendingPeer } = useCurrentUserPeer();
  const {
    data: rooms,
    pending: pendingRooms,
    error,
  } = useRead(roomsResource, {
    params: peer,
    defaultValue: [],
    map: (cache, { accountId }) => cache[accountId],
  });

  return { peer, rooms, pending: pendingPeer || pendingRooms, error };
};

export const useProductSessions = () => {
  const { peer, rooms, pending, error } = useUserRooms();

  const sessions = useMemo(() => (peer ? rooms.map(r => createProductChatSession(peer, r)) : []), [peer, rooms]);

  return { data: sessions, pending, error };
};

// The current user's product chat rooms across every product — each carries its
// `productId` and `sessionId`, so callers that handle many products at once (e.g.
// a dashboard grid) can look up a product's room without a per-product hook.
export const useUserProductRooms = () => {
  const { rooms, pending, error } = useUserRooms();
  return { data: rooms, pending, error };
};

// The current user's chat rooms for a single product.
export const useProductRooms = (productId: Nullable<string>) => {
  const { rooms, pending, error } = useUserRooms();

  const data = useMemo(() => (productId ? rooms.filter(room => room.productId === productId) : []), [rooms, productId]);

  return { data, pending, error };
};

// Worker-declared rooms held in memory until the user confirms Proceed in Chat.
export const useDeclaredProductRooms = (productId: Nullable<string>) => {
  const declared = useObservable(declaredProductRooms$, []);
  const data = useMemo(() => (productId ? declared.filter(room => room.productId === productId) : []), [declared, productId]);

  return { data, pending: false, error: null };
};

export const useCreateProductRoom = () => useAction(createProductRoom);
