/**
 * Query helpers and `lastUpdate` stamp helpers for p2p-chat tables.
 * Sync's collector uses `listMessagesChangedSince` to gather entities;
 * write-side callers use `stampMessage` / `stampRoom` / `stampRequest` to
 * make sure mutations bump `lastUpdate` so they're visible to sync.
 */

import { type ChatMessage } from '../session/types';

import { p2pChatDatabase } from './repository';
import { type P2PChatRequest, type P2PRoom } from './types';

export const listMessagesChangedSince = (timestamp: number): Promise<ChatMessage[]> =>
  p2pChatDatabase.messages.where('lastUpdate').above(timestamp).toArray();

export const listRoomsChangedSince = (timestamp: number): Promise<P2PRoom[]> =>
  p2pChatDatabase.rooms.where('lastUpdate').above(timestamp).toArray();

export const listRequestsChangedSince = (timestamp: number): Promise<P2PChatRequest[]> =>
  p2pChatDatabase.requests.where('lastUpdate').above(timestamp).toArray();

export const stampMessage = (m: ChatMessage): ChatMessage => ({ ...m, lastUpdate: Date.now() });
export const stampRoom = (r: P2PRoom): P2PRoom => ({ ...r, lastUpdate: Date.now() });
export const stampRequest = (r: P2PChatRequest): P2PChatRequest => ({ ...r, lastUpdate: Date.now() });
