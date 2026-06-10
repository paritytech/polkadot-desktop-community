import { liveQuery } from 'dexie';
import { produce } from 'immer';
import { Observable, from, map, of, switchMap, take, tap } from 'rxjs';

import { createStreamResource } from '@/shared/resource';
/* eslint-disable-next-line boundaries/dependencies -- leaf signal module; importing
   via @/domains/device-sync index would create a cycle (device-sync/applier
   imports chat/p2p/repository). */
import { signalLocalChange } from '@/domains/device-sync/localChangeSignal';
import { chatMessageService } from '../session/service';
import { type ChatMessage } from '../session/types';

import { stampMessage, stampRequest, stampRoom } from './listChanged';
import { p2pChatDatabase } from './repository';
import { type P2PChatRequest, type P2PRoom } from './types';

// ── Messages ────────────────────────────────────────────────────────────

const sortMessages = (a: ChatMessage, b: ChatMessage) => a.timestamp - b.timestamp;

export const p2pMessagesResource = createStreamResource<{ sessionId: string }>({
  key: ({ sessionId }) => sessionId,
})
  .subscribe<ChatMessage[]>(({ sessionId }) => {
    return new Observable<ChatMessage[]>(s => {
      const getQuery = () =>
        p2pChatDatabase.messages
          .where('sessionId')
          .equals(sessionId)
          .toArray()
          .then(x => x.sort(sortMessages));

      const query = liveQuery(getQuery);
      const subscription = query.subscribe(x => s.next(x));

      getQuery().then(x => s.next(x));

      return () => subscription.unsubscribe();
    });
  })
  .cache<Record<string, ChatMessage[]>>({
    initial: {},
    map(cache, messages, { sessionId }) {
      return produce(cache, draft => {
        draft[sessionId] = messages;
      });
    },
  })
  .build();

export function createP2PMessage(message: ChatMessage): Observable<{ messageId: string }> {
  return from(p2pChatDatabase.messages.get(message.messageId)).pipe(
    switchMap(existing => {
      // A re-write of the same messageId — history replay on reload, a peer
      // re-delivery, an out-of-order arrival — must not regress status.
      // Preserve the persisted read/delivery marker unless the incoming write
      // genuinely advances it (e.g. the local read flip `new → seen`).
      const status =
        existing && !chatMessageService.shouldUpgradeStatus(existing.status, message.status) ? existing.status : message.status;

      return from(p2pChatDatabase.messages.put(stampMessage({ ...message, status })));
    }),
    tap(() => signalLocalChange()),
    map(() => ({ messageId: message.messageId })),
    take(1),
  );
}

export function updateP2PMessageStatus({
  messageId,
  status,
}: {
  messageId: string;
  sessionId: string;
  status: ChatMessage['status'];
}): Observable<null> {
  return from(p2pChatDatabase.messages.update(messageId, { status, lastUpdate: Date.now() })).pipe(
    tap(() => signalLocalChange()),
    map(() => null),
    take(1),
  );
}

export function deleteP2PMessage({ messageId }: { messageId: string }): Observable<null> {
  return from(p2pChatDatabase.messages.delete(messageId)).pipe(
    tap(() => signalLocalChange()),
    map(() => null),
    take(1),
  );
}

export function deleteP2PMessages({ sessionId }: { sessionId: string }): Observable<null> {
  return p2pMessagesResource.read$({ sessionId }).pipe(
    switchMap(messages => from(p2pChatDatabase.messages.bulkDelete(messages.map(m => m.messageId)))),
    map(() => null),
    take(1),
  );
}

export function markP2PMessagesAsRead({ sessionId }: { sessionId: string }): Observable<null> {
  return from(p2pChatDatabase.messages.where('sessionId').equals(sessionId).toArray()).pipe(
    map(messages =>
      messages
        .filter(m => m.status.direction === 'incoming' && m.status.state === 'new')
        .map(m => ({
          ...m,
          status: m.status.direction === 'incoming' ? { ...m.status, state: 'seen' as const } : m.status,
        })),
    ),
    switchMap(messages => (messages.length ? from(p2pChatDatabase.messages.bulkPut(messages.map(stampMessage))) : of(null))),
    tap(() => signalLocalChange()),
    map(() => null),
    take(1),
  );
}

// ── Rooms ───────────────────────────────────────────────────────────────

export const p2pRoomsResource = createStreamResource<{ userId: string }>({
  key: ({ userId }) => userId,
})
  .subscribe<P2PRoom[]>(({ userId }) => {
    return new Observable<P2PRoom[]>(s => {
      const getQuery = () => p2pChatDatabase.rooms.where('userId').equals(userId).toArray();

      const query = liveQuery(getQuery);
      const subscription = query.subscribe(x => s.next(x));

      getQuery().then(x => s.next(x));

      return () => subscription.unsubscribe();
    });
  })
  .cache<Record<string, P2PRoom[]>>({
    initial: {},
    map(cache, rooms, { userId }) {
      return produce(cache, draft => {
        draft[userId] = rooms;
      });
    },
  })
  .build();

export function createP2PRoom(room: P2PRoom): Observable<{ room: P2PRoom; status: 'New' | 'Exists' }> {
  const existing = from(p2pChatDatabase.rooms.where('sessionId').equals(room.sessionId).first());

  return existing.pipe(
    switchMap(ex => {
      if (ex) {
        // Update userId if session was re-paired with a different account
        if (ex.userId !== room.userId) {
          return from(p2pChatDatabase.rooms.update(room.sessionId, { userId: room.userId, lastUpdate: Date.now() })).pipe(
            map(() => ({ room: { ...ex, userId: room.userId }, status: 'Exists' as const })),
          );
        }

        return from([{ room: ex, status: 'Exists' as const }]);
      }

      return from(p2pChatDatabase.rooms.add(stampRoom(room))).pipe(map(() => ({ room, status: 'New' as const })));
    }),
    take(1),
  );
}

export function deleteP2PRoom({ sessionId }: { sessionId: string }): Observable<null> {
  return from(p2pChatDatabase.rooms.delete(sessionId)).pipe(
    map(() => null),
    take(1),
  );
}

export function setP2PRoomBlocked({ sessionId, isBlocked }: { sessionId: string; isBlocked: boolean }): Observable<null> {
  return from(p2pChatDatabase.rooms.update(sessionId, { isBlocked })).pipe(
    map(() => null),
    take(1),
  );
}

// ── Requests ────────────────────────────────────────────────────────────

export const p2pRequestsResource = createStreamResource<{ userId: string }>({
  key: ({ userId }) => userId,
})
  .subscribe<P2PChatRequest[]>(({ userId }) => {
    return new Observable<P2PChatRequest[]>(s => {
      const getQuery = () => p2pChatDatabase.requests.where('userId').equals(userId).toArray();

      const query = liveQuery(getQuery);
      const subscription = query.subscribe(x => s.next(x));

      getQuery().then(x => s.next(x));

      return () => subscription.unsubscribe();
    });
  })
  .cache<Record<string, P2PChatRequest[]>>({
    initial: {},
    map(cache, reqs, { userId }) {
      return produce(cache, draft => {
        draft[userId] = reqs;
      });
    },
  })
  .build();

export function upsertP2PRequest(request: P2PChatRequest): Observable<null> {
  return from(p2pChatDatabase.requests.put(stampRequest(request))).pipe(
    map(() => null),
    take(1),
  );
}

export function deleteP2PRequest({ requestId }: { requestId: string }): Observable<null> {
  return from(p2pChatDatabase.requests.delete(requestId)).pipe(
    map(() => null),
    take(1),
  );
}
