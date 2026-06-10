import { type Notification } from 'electron';

// Tracks live immediate-notification instances grouped by an opaque session
// key. Replaces the inline `activeNotifications: Map<string, Notification[]>`
// that used to live in main/index.ts so that chat-style "clear all for session"
// continues to work alongside scheduled notifications.
export type ActiveRegistry = {
  register(sessionKey: string, notification: Notification): void;
  closeForSession(sessionKey: string): void;
};

export function createActiveRegistry(): ActiveRegistry {
  const bySession = new Map<string, Notification[]>();

  function register(sessionKey: string, notification: Notification): void {
    const list = bySession.get(sessionKey) ?? [];
    list.push(notification);
    bySession.set(sessionKey, list);

    notification.on('close', () => {
      const current = bySession.get(sessionKey);
      if (!current) return;
      const idx = current.indexOf(notification);
      if (idx !== -1) current.splice(idx, 1);
      if (current.length === 0) bySession.delete(sessionKey);
    });
  }

  function closeForSession(sessionKey: string): void {
    const list = bySession.get(sessionKey);
    if (!list) return;
    for (const notification of list) {
      notification.close();
    }
    bySession.delete(sessionKey);
  }

  return { register, closeForSession };
}
