/**
 * Creates a ChatSession (Observable-based interface) for a P2P room.
 * Mirrors product/session.ts but backed by P2P resources and manager.
 */

import { distinctUntilChanged, from, map } from 'rxjs';

import { chatMessageService } from '../session/service';
import { type ChatSession, type MessageContent } from '../session/types';

import { p2pMessagesResource, p2pRoomsResource } from './resource';
import { type P2PChatManager, type P2PPeer, type P2PRoom } from './types';

export const createP2PChatSession = (peer: P2PPeer, room: P2PRoom, manager: P2PChatManager): ChatSession => {
  // Live-read peerUsername from the room roster so a background refresh
  // (manager.initialize() resolves missing usernames against
  // `Resources.Consumers`) propagates to the chat list + header without
  // needing the user to reopen the chat. Falls back to the snapshot value
  // for the brief moment before the first stream emit.
  const liveRoom$ = p2pRoomsResource
    .read$({ userId: room.userId })
    .pipe(map(rooms => rooms.find(r => r.sessionId === room.sessionId)));
  const name = liveRoom$.pipe(
    map(r => r?.peerUsername ?? room.peerUsername),
    distinctUntilChanged(),
  );
  const messages = p2pMessagesResource.read$(room);
  const participants = from([[peer]]);
  // Resolves the live room from the user-scoped roster so a Dexie write from
  // setBlocked propagates back to the UI without needing a separate per-room
  // stream resource. `?? room.isBlocked` covers the brief window before the
  // stream emits its first value.
  const isBlocked = liveRoom$.pipe(map(r => r?.isBlocked ?? room.isBlocked ?? false));
  const peerSeen = liveRoom$.pipe(
    map(r => r?.peerSeen ?? null),
    distinctUntilChanged(
      (a, b) => a === b || (a !== null && b !== null && chatMessageService.compareMessagePositions(a, b) === 0),
    ),
  );
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
        // Transport-only signals (call answer/ice/closed, device sync rows) and
        // reactions are not readable messages — counting them leaves a phantom
        // badge on a room the user has already seen.
        if (!chatMessageService.isStandaloneMessage(m.content)) return acc;

        return acc + (m.status.direction === 'incoming' && m.status.state === 'new' ? 1 : 0);
      }, 0),
    ),
  );

  return {
    sessionId: room.sessionId,
    roomId: room.peerId,
    participants,
    name,
    messages,
    lastMessage,
    unreadCount,
    isBlocked,
    peerSeen,

    async setBlocked(blocked: boolean) {
      await manager.setBlocked(room.peerId, blocked);
    },

    async sendMessage(content: MessageContent) {
      return manager.sendMessage(room.peerId, content);
    },

    async markAsRead() {
      await manager.markAsRead(room.peerId);
    },

    async deleteSession() {
      await manager.removeSession(room.peerId);
    },
  };
};
