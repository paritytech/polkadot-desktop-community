import { type BrowserWindow, Notification, ipcMain } from 'electron';

import { createNotificationsManager } from './NotificationsManager';
import { createActiveRegistry } from './activeRegistry';
import { createClickRouter } from './clickRouter';
import { createScheduler } from './scheduler';
import { createNotificationStore } from './store';
import { type NotificationActivatedEvent, type NotificationId, type QueueEntry, type ScheduleRequest } from './types';

export const NOTIFICATION_ACTIVATED_CHANNEL = 'notifications:activated';
const LEGACY_NOTIFICATION_CLICKED_CHANNEL = 'notification-clicked';

export type SetupNotificationsDeps = {
  getMainWindow: () => BrowserWindow | null;
  // Called when a notification click arrives while the renderer isn't ready.
  // Implementations typically create a window (cold-launch case) and let the
  // newly-arrived window subscribe via onNotificationActivated.
  ensureMainWindow: () => BrowserWindow;
};

export function setupNotifications(deps: SetupNotificationsDeps): VoidFunction {
  const store = createNotificationStore();
  const clickRouter = createClickRouter();
  const scheduler = createScheduler({
    fire(entry: QueueEntry) {
      const notification = new Notification({ title: entry.title, body: entry.text });
      notification.show();
      return {
        onClick(listener) {
          notification.on('click', () => listener());
        },
      };
    },
  });
  const manager = createNotificationsManager({ store, scheduler, clickRouter });
  const activeRegistry = createActiveRegistry();

  // Re-arm any persisted entries from a prior session.
  void manager.rehydrate();

  function deliverActivation(event: NotificationActivatedEvent): void {
    const existing = deps.getMainWindow();
    const target = existing ?? deps.ensureMainWindow();
    if (existing) {
      if (target.isMinimized()) target.restore();
      target.focus();
      target.webContents.send(NOTIFICATION_ACTIVATED_CHANNEL, event);
    } else {
      target.webContents.once('did-finish-load', () => {
        target.webContents.send(NOTIFICATION_ACTIVATED_CHANNEL, event);
      });
    }
  }

  // The router buffers when no listener is attached. The single in-process
  // listener registered here turns those into IPC sends to the renderer.
  const offRouter = clickRouter.subscribe(deliverActivation);

  // --- Immediate notifications (preserves today's behaviour) ---

  // Today's renderer-side click listener matches on the same string id that
  // the renderer hands us. The new flow translates the click to a
  // NotificationActivatedEvent so all activations funnel through one channel.
  ipcMain.handle(
    'showNotification',
    (_event, payload: { id: string; title: string; body: string; productId?: string; deeplink?: string | null }) => {
      const notification = new Notification({ title: payload.title, body: payload.body });
      // Legacy event for callers still using onNotificationClicked.
      notification.on('click', () => {
        const existing = deps.getMainWindow();
        const target = existing ?? deps.ensureMainWindow();
        if (existing) {
          if (target.isMinimized()) target.restore();
          target.focus();
          target.webContents.send(LEGACY_NOTIFICATION_CLICKED_CHANNEL, payload.id);
        } else {
          target.webContents.once('did-finish-load', () => {
            target.webContents.send(LEGACY_NOTIFICATION_CLICKED_CHANNEL, payload.id);
          });
        }

        if (payload.productId) {
          clickRouter.emit({ productId: payload.productId, deeplink: payload.deeplink ?? null });
        }
      });
      activeRegistry.register(payload.id, notification);
      notification.show();
    },
  );

  ipcMain.handle('clearNotificationsForSession', (_event, sessionId: string) => {
    activeRegistry.closeForSession(sessionId);
  });

  // --- Scheduled notifications ---

  ipcMain.handle('scheduleNotification', async (_event, req: ScheduleRequest) => {
    return manager.schedule(req);
  });

  ipcMain.handle('cancelNotification', async (_event, { productId, id }: { productId: string; id: NotificationId }) => {
    await manager.cancel(productId, id);
  });

  ipcMain.handle('cancelAllNotificationsForProduct', async (_event, productId: string) => {
    await manager.cancelAllForProduct(productId);
  });

  ipcMain.handle('reconcileNotifications', async (_event, installedProductIds: string[]) => {
    await manager.reconcileInstalled(installedProductIds);
  });

  return () => {
    offRouter();
    manager.dispose();
    ipcMain.removeHandler('showNotification');
    ipcMain.removeHandler('clearNotificationsForSession');
    ipcMain.removeHandler('scheduleNotification');
    ipcMain.removeHandler('cancelNotification');
    ipcMain.removeHandler('cancelAllNotificationsForProduct');
    ipcMain.removeHandler('reconcileNotifications');
  };
}
