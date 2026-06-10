import 'source-map-support/register';

import { version as appVersion } from '~config';
import { electronProtocol } from '~config';
import { BrowserWindow, app, ipcMain, net, protocol, shell, systemPreferences, webContents } from 'electron';
import { REACT_DEVELOPER_TOOLS, installExtension } from 'electron-devtools-installer';

import { setupAppCrashMonitoring, setupWindowCrashRecovery } from './factories/crash-recovery';
import { runAppSingleInstance } from './factories/instance';
import { setupLogExport, setupLogger } from './factories/logs';
import { setupPowerMonitor } from './factories/power-monitor';
import {
  extractDeepLinkFromArgv,
  onRendererReady,
  processDeepLink,
  registerDeepLinkProtocol,
  setupDeepLinkHandlers,
} from './factories/protocol';
import { setAutoUpdaterMainWindow, setupAutoUpdater } from './factories/updater';
import { createWindow } from './factories/window';
import { setupWindowDrag } from './factories/window-drag';
import { setupNotifications } from './notifications';
import { setupSandbox } from './sandbox';
import { ENVIRONMENT } from './shared/constants/environment';
import { PLATFORM } from './shared/constants/platform';
import { getOsType } from './shared/lib/utils';
import { type ProxyFetchRequest, type ProxyFetchResponse } from './shared/proxyFetch';
import { initSentry } from './shared/sentry';
import { registerUpdateChannelSyncIpc } from './shared/update-channel';

// Applied before requestSingleInstanceLock — the lock is keyed on userData, so
// isolating the userData path per e2e instance also gives each instance its own lock.
if (process.env['ELECTRON_USER_DATA']) {
  app.setPath('userData', process.env['ELECTRON_USER_DATA']);
}

runAppSingleInstance(async () => {
  initSentry();
  registerUpdateChannelSyncIpc();
  setupLogger();
  setupSandbox(() => mainWindow?.webContents ?? null);
  setupAppCrashMonitoring();
  registerDeepLinkProtocol();

  // Register OS-level deep-link handlers before app.whenReady() so no event
  // is missed. The getter is a closure over `mainWindow` declared below.
  setupDeepLinkHandlers(() => mainWindow);

  protocol.registerSchemesAsPrivileged([
    {
      scheme: electronProtocol,
      privileges: {
        standard: true, // Enables URL parsing like http/https
        secure: true, // Treated as secure context
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);

  app.commandLine.appendSwitch('force-color-profile', 'srgb');
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
  if (ENVIRONMENT.IS_DEV) {
    app.commandLine.appendSwitch('ignore-certificate-errors');
  }

  if (PLATFORM.IS_LINUX) {
    app.disableHardwareAcceleration();
  }

  await app.whenReady();

  let mainWindow: BrowserWindow | null = createWindow();
  setupWindowCrashRecovery(mainWindow);
  setupPowerMonitor(mainWindow);
  setupAutoUpdater(mainWindow);
  // Registered once; the closure tracks the current window across re-creations.
  setupWindowDrag(() => mainWindow);

  // Windows / Linux cold start: the deep-link URL is already in process.argv.
  // processDeepLink will store the route for the renderer to pull on mount.
  if (PLATFORM.IS_WINDOWS || PLATFORM.IS_LINUX) {
    const url = extractDeepLinkFromArgv(process.argv);
    if (url) processDeepLink(url, mainWindow);
  }

  // The renderer signals when it has mounted and registered its protocol-open
  // listener. At that point any pending cold-start deeplink is flushed.
  ipcMain.on('deeplink-renderer-ready', () => {
    if (mainWindow) onRendererReady(mainWindow);
  });

  app.on('activate', () => {
    if (mainWindow === null) {
      mainWindow = createWindow();
      setupWindowCrashRecovery(mainWindow);
      setupPowerMonitor(mainWindow);
      setAutoUpdaterMainWindow(mainWindow);
    }
  });

  app.on('web-contents-created', (_, contents) =>
    contents.on('will-navigate', event => !ENVIRONMENT.IS_DEV && event.preventDefault()),
  );

  app.on('window-all-closed', () => {
    if (!PLATFORM.IS_MAC) {
      app.quit();
    }

    setAutoUpdaterMainWindow(null);
    mainWindow?.destroy();
    mainWindow = null;
  });

  setupLogExport();

  ipcMain.on('reload', () => mainWindow?.webContents.reload());
  ipcMain.on('window:close', () => mainWindow?.close());
  ipcMain.handle('window:get-fullscreen', event => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return window?.isFullScreen() ?? false;
  });
  ipcMain.on('focusWindow', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  const preloadPath = app.getPath('temp');
  ipcMain.handle('getPreloadPath', () => preloadPath);

  setupNotifications({
    getMainWindow: () => mainWindow,
    ensureMainWindow: () => {
      if (mainWindow === null) {
        mainWindow = createWindow();
        setupWindowCrashRecovery(mainWindow);
        setupPowerMonitor(mainWindow);
        setAutoUpdaterMainWindow(mainWindow);
      }
      return mainWindow;
    },
  });

  ipcMain.handle('setBadgeCount', (_event, count: number) => {
    app.setBadgeCount(count);
  });

  ipcMain.handle(
    'requestSystemDevicePermission',
    async (_event, permission: 'Camera' | 'Microphone' | 'Bluetooth' | 'Location'): Promise<boolean> => {
      if (process.platform !== 'darwin') return true;

      const mediaType = permission === 'Camera' ? 'camera' : permission === 'Microphone' ? 'microphone' : null;
      if (!mediaType) return true;

      const status = systemPreferences.getMediaAccessStatus(mediaType);
      if (status === 'granted') return true;
      if (status === 'denied' || status === 'restricted') return false;

      return systemPreferences.askForMediaAccess(mediaType);
    },
  );

  ipcMain.handle('openSystemPrivacySettings', async (_event, permission: 'Camera' | 'Microphone'): Promise<boolean> => {
    const url =
      process.platform === 'darwin'
        ? permission === 'Camera'
          ? 'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera'
          : 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
        : process.platform === 'win32'
          ? permission === 'Camera'
            ? 'ms-settings:privacy-webcam'
            : 'ms-settings:privacy-microphone'
          : null;

    if (url === null) {
      return false;
    }

    try {
      await shell.openExternal(url);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle(
    'getHostMetadata',
    (): { hostName?: string; hostVersion?: string; platformType?: string; platformVersion?: string } => ({
      hostName: 'Polkadot Desktop',
      hostVersion: appVersion,
      platformType: getOsType(),
      platformVersion: process.getSystemVersion(),
    }),
  );

  ipcMain.handle('getWebContentsMemory', (_event, webContentsId: number): number | null => {
    const target = webContents.fromId(webContentsId);
    if (!target || target.isDestroyed()) return null;

    let pid: number;
    try {
      pid = target.getOSProcessId();
    } catch {
      return null;
    }
    if (!pid) return null;

    const entry = app.getAppMetrics().find(m => m.pid === pid);
    if (!entry) return null;

    return entry.memory.workingSetSize * 1024;
  });

  // Performs a fetch in the main process so callers bypass renderer CORS. Used by push
  // notifications and by product workers (which gate the URL against the product's remote
  // permissions in the renderer before calling this). The sandbox never reaches this directly —
  // only trusted host-renderer code does.
  ipcMain.handle('proxyFetch', async (_event, req: ProxyFetchRequest): Promise<ProxyFetchResponse> => {
    const response = await net.fetch(req.url, {
      method: req.method,
      headers: req.headers,
      // Re-wrap into an ArrayBuffer-backed view so it satisfies BodyInit.
      body: req.body ? new Uint8Array(req.body) : undefined,
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: [...response.headers],
      body: new Uint8Array(await response.arrayBuffer()),
      url: response.url,
      redirected: response.redirected,
    };
  });

  if (ENVIRONMENT.IS_DEV) {
    await installExtension(REACT_DEVELOPER_TOOLS);

    // Reloading extensions for correct initialization in dev tools
    // session.defaultSession.extensions.getAllExtensions().map(e => {
    //   session.defaultSession.extensions.loadExtension(e.path);
    // });
  }
});
