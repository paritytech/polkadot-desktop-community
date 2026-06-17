/**
 * Inbound **local OS** notifications: subscribes to the room/message resources
 * and fires desktop notifications + badge counts for our own unread messages.
 *
 * Distinct from the `notifications/` sub-module, which handles **outbound push**
 * to a peer's mobile device. This is a container-root orchestration primitive
 * (effect-orchestration over domain resources, no canonical leaf home — see the
 * `chat/p2p` README); its lifecycle is driven from the aggregate's headless
 * binding via `notifications/hooks.ts`.
 */

import { combineLatest, map, of, switchMap } from 'rxjs';

import { isElectron } from '@/shared/env';

import { p2pMessagesResource, p2pRoomsResource } from './resource';

type NotificationServiceParams = {
  userId: string;
  getActiveChatId: () => string | null;
  navigateToChat: (sessionId: string) => void;
};

type NotificationServiceHandle = {
  dispose: VoidFunction;
};

const extractNotificationText = (content: {
  type: string;
  text?: string;
  emoji?: string;
  content?: { type: string; text?: string };
}): string => {
  if (content.type === 'text' && content.text) return content.text;
  if (content.type === 'reply' && content.content?.type === 'text' && content.content.text) return content.content.text;
  if (content.type === 'reacted') return `Reacted ${content.emoji ?? ''}`.trim();
  if (content.type === 'reactionRemoved') return 'Removed a reaction';

  return 'New message';
};

// Tracks already-notified unread message IDs per user, kept at module scope so
// service re-creation (caused e.g. by `useNotificationService`'s effect
// re-running on `getActiveChatId`/`navigateToChat` identity changes — every
// route navigation rebuilds those) doesn't reset state and re-fire OS
// notifications for messages that are still in the "unread" set.
const previousUnreadIdsByUser = new Map<string, Map<string, Set<string>>>();

export const createNotificationService = (params: NotificationServiceParams): NotificationServiceHandle => {
  if (!isElectron()) {
    return { dispose: () => {} };
  }

  const { userId, getActiveChatId, navigateToChat } = params;

  let previousUnreadIds = previousUnreadIdsByUser.get(userId) ?? new Map<string, Set<string>>();
  previousUnreadIdsByUser.set(userId, previousUnreadIds);
  let windowFocused = document.hasFocus();

  const onFocus = () => {
    windowFocused = true;
  };
  const onBlur = () => {
    windowFocused = false;
  };
  window.addEventListener('focus', onFocus);
  window.addEventListener('blur', onBlur);

  const unsubNotificationClick = window.App.onNotificationClicked((sessionId: string) => {
    navigateToChat(sessionId);
  });

  // Rooms + per-room message streams come from the domain resources (the
  // validated Dexie read path) — the repository is never queried directly.
  const emptyUnread = () => new Map<string, { count: number; ids: Set<string>; peerName: string; text: string }>();

  const unread$ = p2pRoomsResource.read$({ userId }).pipe(
    switchMap(rooms => {
      if (rooms.length === 0) return of({ unreadBySession: emptyUnread() });

      return combineLatest(
        rooms.map(room => p2pMessagesResource.read$({ sessionId: room.sessionId }).pipe(map(messages => ({ room, messages })))),
      ).pipe(
        map(perRoom => {
          const unreadBySession = emptyUnread();

          for (const { room, messages } of perRoom) {
            const unreadMessages = messages.filter(m => m.status.direction === 'incoming' && m.status.state === 'new');

            const ids = new Set(unreadMessages.map(m => m.messageId));
            const latest = unreadMessages.at(-1);

            unreadBySession.set(room.sessionId, {
              count: unreadMessages.length,
              ids,
              peerName: room.peerUsername || room.sessionId.slice(0, 8),
              text: latest ? extractNotificationText(latest.content) : '',
            });
          }

          return { unreadBySession };
        }),
      );
    }),
  );

  const subscription = unread$.subscribe({
    next({ unreadBySession }) {
      const activeChatId = getActiveChatId();
      let totalUnread = 0;

      for (const [sessionId, data] of unreadBySession) {
        totalUnread += data.count;

        const prevIds = previousUnreadIds.get(sessionId) ?? new Set();
        const newIds = new Set([...data.ids].filter(id => !prevIds.has(id)));

        const isChatInFocus = sessionId === activeChatId && windowFocused;
        if (newIds.size > 0 && !isChatInFocus && data.text) {
          window.App.showNotification({
            id: sessionId,
            title: data.peerName,
            body: data.text,
          });
        }

        if (data.count === 0) {
          window.App.clearNotificationsForSession(sessionId);
        }
      }

      for (const sessionId of previousUnreadIds.keys()) {
        if (!unreadBySession.has(sessionId)) {
          window.App.clearNotificationsForSession(sessionId);
        }
      }

      window.App.setBadgeCount(totalUnread);

      previousUnreadIds = new Map([...unreadBySession].map(([sid, data]) => [sid, data.ids]));
      previousUnreadIdsByUser.set(userId, previousUnreadIds);
    },
  });

  return {
    dispose() {
      subscription.unsubscribe();
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      unsubNotificationClick();
      window.App.setBadgeCount(0);
    },
  };
};
