import { createDexieDatabase } from '@/shared/dexie';
import { type ChatMessage } from '../session/types';

import { type ProductChatRoom } from './types';

export const chatDatabase = createDexieDatabase<{
  messages: ChatMessage;
  rooms: ProductChatRoom;
}>({
  name: 'products-chat',
  version: 1,
  schema: {
    messages: 'messageId, sessionId',
    rooms: 'sessionId, userId',
  },
});

export const clearAllProductChatStorage = async (): Promise<void> => {
  await Promise.all([chatDatabase.messages.clear(), chatDatabase.rooms.clear()]);
};
