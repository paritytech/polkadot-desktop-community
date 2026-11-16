import { nanoid } from 'nanoid';
import {
  type Observable,
  concatMap,
  distinct,
  distinctUntilChanged,
  from,
  lastValueFrom,
  map,
  merge,
  mergeMap,
  pairwise,
} from 'rxjs';

import { type AccountId } from '@/domains/network';
import { commitmentUseCase, productsResource } from '@/domains/product';
import { chatDatabase, findProductRoomBySessionId } from '../product/repository';
import {
  createMessageInProductRoom,
  deleteMessagesInProductRoom,
  deleteProductRoom,
  markProductMessagesAsRead,
  messagesResource,
  roomsResource,
} from '../product/resource';
import { productChatService } from '../product/service';
import { type ProductChatRoom } from '../product/types';
import { chatMessageService } from '../session/service';
import { type ChatMessage, type ChatSession, type MessageContent, type RoomFooter, type UserPeer } from '../session/types';

type CreateRoomParams = {
  roomId: string;
  userId: AccountId;
  productId: string;
};

async function createProductRoom(params: CreateRoomParams): Promise<{ room: ProductChatRoom; status: 'New' | 'Exists' } | null> {
  const { roomId, userId, productId } = params;

  // Commit the product BEFORE creating the room — every chat reference must
  // resolve to a durable Product record.
  const committed = await commitmentUseCase.commitProductByIdentifier(productId);
  if (!committed) return null;

  const sessionId = productChatService.getSessionId(productId, roomId, userId);
  const existing = await findProductRoomBySessionId(sessionId);
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

// The worker's room list must survive a restart, so it is read from storage
// rather than from any in-process registry.
function watchProductRooms(params: { productId: string; userId: AccountId }): Observable<ProductChatRoom[]> {
  return roomsResource
    .read$({ accountId: params.userId })
    .pipe(map(rooms => rooms.filter(room => productChatService.belongsToProduct(room, params.productId))));
}

/** One message the user sent into a product's room, addressed for delivery. */
export type OutgoingProductMessage = {
  roomId: string;
  /** Who sent it, as the product should see the sender. */
  peerId: string;
  content: MessageContent;
};

function messagePeerId(message: ChatMessage): string {
  return message.peer.type === 'product' ? message.peer.productId : message.peer.accountId;
}

/**
 * Messages the user sends into this product's rooms, from the moment of
 * subscription onward.
 *
 * Two filters carry the whole correctness of this stream. `pairwise` drops the
 * backlog: the resource re-emits each room's full list, so without it every existing
 * message would replay as new on subscribe. And only `outgoing` messages qualify —
 * the product's own replies persist as `incoming`, so relaying those would feed a
 * product its own output and loop.
 *
 * Third: one subscription per room. The rooms list re-emits on every rooms-table write
 * (a footer change, a new room), and the message stream replays its last list, so
 * resubscribing per emission would deliver each message once per re-emit. A deleted
 * room's subscription stays open until the whole stream is unsubscribed — accepted.
 */
function watchOutgoingMessages(params: { productId: string; userId: AccountId }): Observable<OutgoingProductMessage> {
  return watchProductRooms(params).pipe(
    mergeMap(rooms => rooms),
    distinct(room => room.sessionId),
    mergeMap(room =>
      messagesResource.read$({ sessionId: room.sessionId }).pipe(
        pairwise(),
        concatMap(([previous, next]) => {
          const seen = new Set(previous.map(message => message.messageId));

          return next.filter(message => !seen.has(message.messageId) && message.status.direction === 'outgoing');
        }),
        map((message): OutgoingProductMessage => ({
          roomId: room.roomId,
          peerId: messagePeerId(message),
          content: message.content,
        })),
      ),
    ),
  );
}

function createProductChatSession(peer: UserPeer, room: ProductChatRoom): ChatSession {
  const name = productsResource
    .read$({})
    .pipe(map(records => records.find(r => r.baseName === room.productId)?.displayName ?? room.productId));
  const messages = messagesResource.read$(room);
  // TODO implement
  const participants = from([]);
  const lastMessage = messages.pipe(
    map(x => {
      for (let i = x.length - 1; i >= 0; i--) {
        const m = x[i];
        if (m && chatMessageService.isStandaloneMessage(m.content)) {
          return m;
        }
      }

      return null;
    }),
  );
  const unreadCount = messages.pipe(
    map(x =>
      x.reduce((acc, m) => {
        if (m.content.type === 'reacted' || m.content.type === 'reactionRemoved') return acc;

        return acc + (m.status.direction === 'incoming' && m.status.state === 'new' ? 1 : 0);
      }, 0),
    ),
  );

  // Read from the stored row, not the snapshot: the product changes it while the session lives.
  const footer = roomsResource.read$({ accountId: room.userId }).pipe(
    map((rooms): RoomFooter => rooms.find(r => r.sessionId === room.sessionId)?.footer ?? { type: 'text' }),
    distinctUntilChanged(productChatService.isSameFooter),
  );

  return {
    sessionId: room.sessionId,
    roomId: room.roomId,
    participants,
    name,
    messages,
    lastMessage,
    unreadCount,
    footer,

    async sendMessage(content: MessageContent) {
      const messageId = nanoid(32);
      const now = Date.now();

      const message: ChatMessage = {
        messageId,
        sessionId: room.sessionId,
        peer,
        content,
        timestamp: now,
        status: {
          direction: 'outgoing',
          state: 'sent',
        },
      };

      await lastValueFrom(createMessageInProductRoom(message));

      return { messageId };
    },

    async markAsRead() {
      await lastValueFrom(markProductMessagesAsRead(room));
    },

    async deleteSession() {
      await lastValueFrom(merge(deleteMessagesInProductRoom(room), deleteProductRoom(room)));
    },
  };
}

type SetFooterParams = {
  productId: string;
  roomId: string;
  userId: AccountId;
  footer: RoomFooter;
};

async function setProductRoomFooter(params: SetFooterParams): Promise<'Applied' | 'UnknownRoom'> {
  const { productId, roomId, userId, footer } = params;
  const sessionId = productChatService.getSessionId(productId, roomId, userId);

  return chatDatabase.rooms.db.transaction('rw', chatDatabase.rooms, async () => {
    const stored = await chatDatabase.rooms.get(sessionId);
    if (!stored) return 'UnknownRoom';

    // Every rooms write re-emits `roomsResource` and rebuilds the product sessions, so a repeat must not write.
    if (!productChatService.isSameFooter(stored.footer ?? { type: 'text' }, footer)) {
      await chatDatabase.rooms.update(sessionId, { footer });
    }

    return 'Applied';
  });
}

export const productRoomUseCase = {
  setProductRoomFooter,
  createProductRoom,
  watchOutgoingMessages,
  createProductChatSession,
  watchProductRooms,
};
