import { liveQuery } from 'dexie';
import { produce } from 'immer';
import { Observable, from, map, of, switchMap, take } from 'rxjs';

import { createStreamResource } from '@/shared/resource';
import { type AccountId } from '@/domains/network';
import { commitmentUseCase } from '@/domains/product';
import { type ChatMessage } from '../session/types';

import { chatDatabase } from './repository';
import { productChatService } from './service';
import { type ProductChatRoom } from './types';

// messages

function sortMessages(a: ChatMessage, b: ChatMessage) {
  return a.timestamp - b.timestamp;
}

export const messagesResource = createStreamResource<{ sessionId: string }>({
  key: ({ sessionId }) => sessionId,
})
  .subscribe<ChatMessage[]>(({ sessionId }) => {
    return new Observable<ChatMessage[]>(s => {
      const getQuery = () =>
        chatDatabase.messages
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

export function createMessageInProductRoom(message: ChatMessage): Observable<{ messageId: string }> {
  return from(chatDatabase.messages.add(message)).pipe(
    map(() => ({ messageId: message.messageId })),
    take(1),
  );
}

export function deleteMessagesInProductRoom({ sessionId }: { sessionId: string }): Observable<null> {
  return messagesResource.read$({ sessionId }).pipe(
    switchMap(messages => from(chatDatabase.messages.bulkDelete(messages.map(m => m.messageId)))),
    map(() => null),
    take(1),
  );
}

export function markProductMessagesAsRead({ sessionId }: { sessionId: string }): Observable<null> {
  return from(chatDatabase.messages.where('sessionId').equals(sessionId).toArray()).pipe(
    map(messages =>
      messages
        .filter(m => m.status.direction === 'incoming' && m.status.state === 'new')
        .map(m => ({
          ...m,
          status: m.status.direction === 'incoming' ? { ...m.status, state: 'seen' as const } : m.status,
        })),
    ),
    switchMap(messages => (messages.length ? from(chatDatabase.messages.bulkPut(messages)) : of(null))),
    map(() => null),
    take(1),
  );
}

// rooms

export const roomsResource = createStreamResource<{ accountId: AccountId }>({
  key: ({ accountId }) => accountId,
})
  .subscribe<ProductChatRoom[]>(({ accountId }) => {
    return new Observable<ProductChatRoom[]>(s => {
      const getQuery = () => chatDatabase.rooms.where('userId').equals(accountId).toArray();

      const query = liveQuery(getQuery);
      const subscription = query.subscribe(x => s.next(x));

      getQuery().then(x => s.next(x));

      return () => subscription.unsubscribe();
    });
  })
  .cache<Record<AccountId, ProductChatRoom[]>>({
    initial: {},
    map(cache, rooms, { accountId }) {
      return produce(cache, draft => {
        draft[accountId] = rooms;
      });
    },
  })
  .build();

type CreateRoomParams = {
  roomId: string;
  userId: AccountId;
  productId: string;
};

export async function createProductRoom(
  params: CreateRoomParams,
): Promise<{ room: ProductChatRoom; status: 'New' | 'Exists' } | null> {
  const { roomId, userId, productId } = params;

  // Commit the product BEFORE creating the room — every chat reference must
  // resolve to a durable Product record.
  const committed = await commitmentUseCase.commitProductByIdentifier(productId);
  if (!committed) return null;

  const sessionId = productChatService.getSessionId(productId, roomId, userId);
  const existing = await chatDatabase.rooms.where('sessionId').equals(sessionId).first();
  if (existing) return { room: existing, status: 'Exists' };

  const room: ProductChatRoom = {
    sessionId,
    roomId,
    productId,
    userId,
    createdAt: Date.now(),
  };
  await chatDatabase.rooms.add(room);
  return { room, status: 'New' };
}

export function deleteProductRoom({ sessionId }: { sessionId: string }): Observable<null> {
  return from(chatDatabase.rooms.delete(sessionId)).pipe(
    map(() => null),
    take(1),
  );
}
