import { type BrowserWindow, app, ipcMain } from 'electron';
import { default as Store } from 'electron-store';
import { autoUpdater } from 'electron-updater';

import { ENVIRONMENT } from '../shared/constants/environment';
import { type UpdateChannel, AUTO_UPDATE_ENABLED, DEFAULT_UPDATE_CHANNEL, UPDATE_CHANNEL } from '../shared/constants/store';
import { checkAutoUpdateSupported } from '../shared/lib/utils';

// Base URL without channel suffix. Runtime appends `stable/` or `latest/`.
const UPDATE_SERVER_URL_BASE = process.env['AUTO_UPDATE_URL'] ?? '';

const MIGRATED_KEY = 'autoUpdateMigratedToS3';

let mainWindowRef: BrowserWindow | null = null;

function sendUpdateEvent(type: string, data?: unknown) {
  mainWindowRef?.webContents.send('app:update-event', { type, data });
}

export function setAutoUpdaterMainWindow(window: BrowserWindow | null) {
  mainWindowRef = window;
}

function normalizeChannel(raw: unknown): UpdateChannel {
  return raw === 'experimental' ? 'experimental' : 'stable';
}

function channelPath(channel: UpdateChannel): string {
  return channel === 'experimental' ? 'latest/' : 'stable/';
}

function computeFeedUrl(channel: UpdateChannel): string {
  const base = UPDATE_SERVER_URL_BASE.endsWith('/') ? UPDATE_SERVER_URL_BASE : `${UPDATE_SERVER_URL_BASE}/`;
  return `${base}${channelPath(channel)}`;
}

export function setupAutoUpdater(mainWindow: BrowserWindow | null) {
  mainWindowRef = mainWindow;
  const isAutoUpdateSupported = checkAutoUpdateSupported();
  // Without a configured feed URL there is nothing to point the updater at, and
  // setFeedURL would parse an invalid relative URL and throw during startup. Honor
  // the documented contract (empty AUTO_UPDATE_URL = auto-update disabled).
  const hasFeedUrl = UPDATE_SERVER_URL_BASE.trim().length > 0;
  const isSupported = !ENVIRONMENT.IS_DEV && hasFeedUrl && (isAutoUpdateSupported || app.isPackaged);
  const store = new Store({
    defaults: {
      [AUTO_UPDATE_ENABLED]: isSupported,
      [UPDATE_CHANNEL]: DEFAULT_UPDATE_CHANNEL,
    },
  });

  // One-time migration: previous builds persisted AUTO_UPDATE_ENABLED as `false`
  // because BUILD_SOURCE wasn't set. Reset to `true` for S3-enabled builds.
  if (isSupported && !store.get(MIGRATED_KEY)) {
    store.set(AUTO_UPDATE_ENABLED, true);
    store.set(MIGRATED_KEY, true);
  }

  const ALLOWED_STORE_KEYS = new Set([AUTO_UPDATE_ENABLED, MIGRATED_KEY, UPDATE_CHANNEL]);

  // Linux arm64 uses a separate metadata file; x64 uses default latest-linux.yml
  const linuxArmChannel = process.platform === 'linux' && process.arch === 'arm64' ? 'latest-linux-arm64' : undefined;

  function applyFeedUrl(channel: UpdateChannel) {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: computeFeedUrl(channel),
      ...(linuxArmChannel && { channel: linuxArmChannel }),
    });
  }

  ipcMain.handle('getStoreValue', (_, key: string) => {
    if (!ALLOWED_STORE_KEYS.has(key)) {
      console.warn('[store] Blocked read of unauthorized key:', key);
      return undefined;
    }
    return store.get(key);
  });

  ipcMain.handle('setStoreValue', (_, key: string, value: unknown) => {
    if (!ALLOWED_STORE_KEYS.has(key)) {
      console.warn('[store] Blocked write of unauthorized key:', key);
      return;
    }
    store.set(key, value);

    if (isSupported && key === UPDATE_CHANNEL) {
      const next = normalizeChannel(value);
      console.info(`[app-updater] Channel changed to "${next}", re-checking for updates.`);
      applyFeedUrl(next);
      autoUpdater.checkForUpdates().catch(err => {
        console.error('[app-updater] Failed to check for updates after channel change:', err.message);
      });
    }
  });

  ipcMain.handle('app:check-for-updates', () => {
    if (!isSupported) {
      sendUpdateEvent('update-not-available');
      return;
    }
    autoUpdater.checkForUpdates().catch(err => {
      console.error('[app-updater] Failed to check for updates:', err.message);
      sendUpdateEvent('error', { message: err.message });
    });
  });

  ipcMain.on('app:quit-and-install', () => {
    autoUpdater.quitAndInstall();
  });

  if (!isSupported) return;

  applyFeedUrl(normalizeChannel(store.get(UPDATE_CHANNEL)));

  autoUpdater.autoRunAppAfterInstall = true;
  autoUpdater.autoInstallOnAppQuit = false;

  app.whenReady().then(() => {
    const enabled = store.get(AUTO_UPDATE_ENABLED);
    if (!enabled) return;

    autoUpdater.checkForUpdates().catch(err => {
      console.error('[app-updater] Failed to check for updates:', err.message);
    });
  });

  autoUpdater.on('checking-for-update', () => {
    console.info('[app-updater] Checking for update...');
    sendUpdateEvent('checking-for-update');
  });

  autoUpdater.on('update-not-available', () => {
    console.info('[app-updater] Application is up to date.');
    sendUpdateEvent('update-not-available');
  });

  autoUpdater.on('update-available', info => {
    console.info(`[app-updater] Update available: ${info.version}`);
    sendUpdateEvent('update-available', info);
  });

  autoUpdater.on('download-progress', progressObj => {
    console.info(`[app-updater] Downloading: ${Math.round(progressObj.percent)}%`);
    sendUpdateEvent('download-progress', progressObj);
  });

  autoUpdater.on('update-cancelled', info => {
    console.info(`[app-updater] Update cancelled: ${info.version}`);
    sendUpdateEvent('update-cancelled', info);
  });

  autoUpdater.on('error', err => {
    console.error('[app-updater] Update error:', err.message);
    sendUpdateEvent('error', { message: err.message });
  });

  autoUpdater.on('update-downloaded', info => {
    console.info(`[app-updater] Update downloaded: ${info.version}`);
    sendUpdateEvent('update-downloaded', info);
  });
}
