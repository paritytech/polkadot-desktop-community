import Dexie, { type Table } from 'dexie';

import { type ChatMessage } from '../session/types';

import { type ProductChatRoom } from './types';

const SCHEMA = {
  messages: 'messageId, sessionId',
  rooms: 'sessionId, userId',
};

type LegacyRoom = ProductChatRoom & { userInput?: 'text' | 'none' };

const dexie = new Dexie('products-chat');
dexie.version(1).stores(SCHEMA);
// v2: a room's `userInput` becomes its `footer`. Only `'none'` is carried over: an absent footer already reads as text.
dexie
  .version(2)
  .stores(SCHEMA)
  .upgrade(tx =>
    tx
      .table<LegacyRoom>('rooms')
      .toCollection()
      .modify(room => {
        if (room.userInput === 'none') room.footer = { type: 'none' };
        delete room.userInput;
      }),
  );

export const chatDatabase: { messages: Table<ChatMessage, string>; rooms: Table<ProductChatRoom, string> } = {
  messages: dexie.table('messages'),
  rooms: dexie.table('rooms'),
};

export const clearAllProductChatStorage = async (): Promise<void> => {
  await Promise.all([chatDatabase.messages.clear(), chatDatabase.rooms.clear()]);
};

/** Full-table read for the chat search use case. */
export function listAllProductMessages(): Promise<ChatMessage[]> {
  return chatDatabase.messages.toArray();
}

export function findProductRoomBySessionId(sessionId: string): Promise<ProductChatRoom | undefined> {
  return chatDatabase.rooms.where('sessionId').equals(sessionId).first();
}
