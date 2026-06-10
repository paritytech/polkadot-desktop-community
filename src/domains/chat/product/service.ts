import { blake2b } from '@noble/hashes/blake2.js';
import { type UserSession } from '@novasamatech/host-papp';
import { toHex } from '@novasamatech/scale';
import * as v from 'valibot';

import { accountId } from '@/domains/network';

function getUserId(session: UserSession) {
  return v.parse(accountId, toHex(session.localAccount.accountId));
}

function getSessionId(productId: string, roomId: string, userId: string) {
  return toHex(blake2b(new TextEncoder().encode(`${userId}-${productId}-${roomId}`)));
}

export const productChatService = {
  getUserId,
  getSessionId,
};
