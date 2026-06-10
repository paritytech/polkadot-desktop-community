import { createNanoEvents } from 'nanoevents';
import { nanoid } from 'nanoid';
import { from, lastValueFrom, map, merge } from 'rxjs';

import { productsResource } from '@/domains/product';
import { type ChatMessage, type ChatSession, type MessageContent, type UserPeer } from '../session/types';

import {
  createMessageInProductRoom,
  deleteMessagesInProductRoom,
  deleteProductRoom,
  markProductMessagesAsRead,
  messagesResource,
} from './resource';
import { type ProductChatRoom } from './types';

const events = createNanoEvents<{ userMessage: (sessionId: string, message: ChatMessage) => void }>();

export function createProductChatSession(peer: UserPeer, room: ProductChatRoom): ChatSession {
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
        if (m && m.content.type !== 'reacted' && m.content.type !== 'reactionRemoved' && m.content.type !== 'edit') {
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

  return {
    sessionId: room.sessionId,
    roomId: room.roomId,
    participants,
    name,
    messages,
    lastMessage,
    unreadCount,

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
      events.emit('userMessage', room.sessionId, message);

      return { messageId };
    },

    onUserMessage(callback) {
      return events.on('userMessage', (sessionId, message) => {
        if (sessionId === room.sessionId) {
          callback(message);
        }
      });
    },

    async markAsRead() {
      await lastValueFrom(markProductMessagesAsRead(room));
    },

    async deleteSession() {
      await lastValueFrom(merge(deleteMessagesInProductRoom(room), deleteProductRoom(room)));
    },
  };
}
