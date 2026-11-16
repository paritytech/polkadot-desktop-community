import { blake2b } from '@noble/hashes/blake2.js';
import { toHex } from '@novasamatech/scale';

import { type RoomFooter } from '../session/types';

import { type ProductChatRoom } from './types';

function belongsToProduct(room: ProductChatRoom, productId: string) {
  return room.productId === productId;
}

function getSessionId(productId: string, roomId: string, userId: string) {
  return toHex(blake2b(new TextEncoder().encode(`${userId}-${productId}-${roomId}`)));
}

function isSameFooter(a: RoomFooter, b: RoomFooter) {
  if (a.type !== 'card' || b.type !== 'card') return a.type === b.type;
  return (
    a.productId === b.productId &&
    a.messageType === b.messageType &&
    a.payload.length === b.payload.length &&
    a.payload.every((byte, i) => byte === b.payload[i])
  );
}

export const productChatService = {
  belongsToProduct,
  getSessionId,
  isSameFooter,
};
