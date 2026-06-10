import { type AccountId } from '@/domains/network';

export type ProductChatRoom = {
  sessionId: string;
  roomId: string;
  productId: string;
  userId: AccountId;
  createdAt: number;
};
