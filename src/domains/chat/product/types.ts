import { type AccountId } from '@/domains/network';
import { type RoomFooter } from '../session/types';

export type ProductChatRoom = {
  sessionId: string;
  roomId: string;
  productId: string;
  userId: AccountId;
  createdAt: number;
  /** Absent reads as `{ type: 'text' }`. */
  footer?: RoomFooter;
};
