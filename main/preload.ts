import { contextBridge, ipcRenderer } from 'electron';

import {
  type DevicePermissionType,
  type ExecutableKind,
  type PermissionStatus,
  type ProductArchive,
  type RemotePermissionIpcRequest,
} from '@/domains/product';

import { type UpdateChannel, AUTO_UPDATE_ENABLED } from './shared/constants/store';
import {
  WEBVIEW_HEALTH_STATE,
  WEBVIEW_RENDER_PROCESS_GONE,
  WEBVIEW_RENDER_PROCESS_RESPONSIVE,
  WEBVIEW_RENDER_PROCESS_UNRESPONSIVE,
} from './shared/constants/webview-events';
import { createPreloadRequestHandler } from './shared/lib/events';
import { checkAutoUpdateSupported } from './shared/lib/utils';
import { type ProxyFetchRequest, type ProxyFetchResponse } from './shared/proxyFetch';

const readUpdateChannel = (): UpdateChannel => {
  const value = ipcRenderer.sendSync('sync:getUpdateChannel');
  return value === 'experimental' ? 'experimental' : 'stable';
};

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging requires interface
  interface Window {
    App: typeof API;
  }
}

const microtask = () => new Promise<void>(resolve => queueMicrotask(resolve));

function toArchiveBytes(files: Record<string, Uint8Array | string>): Record<string, Uint8Array> {
  const encoder = new TextEncoder();
  const out: Record<string, Uint8Array> = {};
  for (const [key, value] of Object.entries(files)) {
    out[key] = typeof value === 'string' ? encoder.encode(value) : value;
  }
  return out;
}

const API = {
  username: process.env['USER'],

  // autoupdate

  isAutoUpdateSupported: checkAutoUpdateSupported(),

  // Sync'd at preload time so the renderer can tag Sentry before any errors fire.
  updateChannel: readUpdateChannel(),

  // Autotest mode — runtime values from Electron process.env
  // Passed via launchElectronApp() in e2e tests, not baked into the build
  autotest: !!process.env['AUTOTEST'],
  e2eTest: !!process.env['E2E_TEST'],
  botUrl: process.env['BOT_URL'] || '',
  botToken: process.env['BOT_TOKEN'] || '',
  getHostMetadata: (): Promise<{
    hostName?: string;
    hostVersion?: string;
    platformType?: string;
    platformVersion?: string;
  }> => ipcRenderer.invoke('getHostMetadata'),
  getWebContentsMemory: (webContentsId: number): Promise<number | null> =>
    ipcRenderer.invoke('getWebContentsMemory', webContentsId),
  getIsAutoUpdateEnabled: () => {
    return ipcRenderer.invoke('getStoreValue', AUTO_UPDATE_ENABLED);
  },
  setIsAutoUpdateEnabled: (value: unknown) => {
    return ipcRenderer.invoke('setStoreValue', AUTO_UPDATE_ENABLED, value);
  },
  getStoreValue: (key: string) => {
    return ipcRenderer.invoke('getStoreValue', key);
  },
  setStoreValue: (key: string, value: unknown) => {
    return ipcRenderer.invoke('setStoreValue', key, value);
  },
  onProtocolOpen: (callback: (value: string) => void) => {
    const handler = (_: unknown, value: string) => callback(value);
    ipcRenderer.on('protocol-open', handler);
    return () => {
      ipcRenderer.removeListener('protocol-open', handler);
    };
  },
  notifyDeepLinkReady: () => ipcRenderer.send('deeplink-renderer-ready'),
  onFullscreenChange: (callback: (isFullscreen: boolean) => void) => {
    const handler = (_: unknown, isFullscreen: boolean) => callback(isFullscreen);
    ipcRenderer.on('fullscreen-change', handler);
    void ipcRenderer.invoke('window:get-fullscreen').then((isFullscreen: boolean) => {
      callback(isFullscreen);
    });
    return () => ipcRenderer.removeListener('fullscreen-change', handler);
  },
  onWindowFocusChange: (callback: (isFocused: boolean) => void) => {
    const handler = (_: unknown, isFocused: boolean) => callback(isFocused);
    ipcRenderer.on('window-focus-change', handler);
    return () => ipcRenderer.removeListener('window-focus-change', handler);
  },
  exportLogs: (): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('exportLogs');
  },
  logRendererConsole: (level: 'info' | 'warn' | 'error', values: unknown[]) => {
    ipcRenderer.send('renderer:console-log', { level, values });
  },
  reload: () => {
    ipcRenderer.send('reload');
    return true as const;
  },
  onResetAppData: (callback: () => void) => {
    return ipcRenderer.on('reset-app-data', () => callback());
  },
  focusWindow: () => {
    ipcRenderer.send('focusWindow');
  },
  showNotification: (options: {
    id: string;
    title: string;
    body: string;
    productId?: string;
    deeplink?: string | null;
  }): Promise<void> => {
    return ipcRenderer.invoke('showNotification', options);
  },
  scheduleNotification: (req: {
    productId: string;
    title: string;
    text: string;
    deeplink: string | null;
    // null means "fire immediately" — main bypasses the persisted queue.
    scheduledAt: number | null;
  }): Promise<{ ok: true; id: number } | { ok: false; error: 'ScheduleLimitReached' | 'Unknown'; reason?: string }> => {
    return ipcRenderer.invoke('scheduleNotification', req);
  },
  cancelNotification: (productId: string, id: number): Promise<void> => {
    return ipcRenderer.invoke('cancelNotification', { productId, id });
  },
  cancelAllNotificationsForProduct: (productId: string): Promise<void> => {
    return ipcRenderer.invoke('cancelAllNotificationsForProduct', productId);
  },
  reconcileNotifications: (installedProductIds: string[]): Promise<void> => {
    return ipcRenderer.invoke('reconcileNotifications', installedProductIds);
  },
  onNotificationActivated: (callback: (event: { productId: string; deeplink: string | null }) => void) => {
    const handler = (_: unknown, payload: { productId: string; deeplink: string | null }) => callback(payload);
    ipcRenderer.on('notifications:activated', handler);
    return () => ipcRenderer.off('notifications:activated', handler);
  },
  requestSystemDevicePermission: (permission: string): Promise<boolean> => {
    return ipcRenderer.invoke('requestSystemDevicePermission', permission);
  },
  openSystemPrivacySettings: (permission: 'Camera' | 'Microphone'): Promise<boolean> => {
    return ipcRenderer.invoke('openSystemPrivacySettings', permission);
  },
  onNotificationClicked: (callback: (id: string) => void) => {
    const handler = (_: unknown, id: string) => callback(id);
    ipcRenderer.on('notification-clicked', handler);
    return () => ipcRenderer.off('notification-clicked', handler);
  },
  setBadgeCount: (count: number): Promise<void> => {
    return ipcRenderer.invoke('setBadgeCount', count);
  },
  clearNotificationsForSession: (sessionId: string): Promise<void> => {
    return ipcRenderer.invoke('clearNotificationsForSession', sessionId);
  },
  onNavigateHistoryBack: (callback: VoidFunction) => {
    const handler = () => callback();
    ipcRenderer.on('navigate:history-back', handler);
    return () => {
      ipcRenderer.removeListener('navigate:history-back', handler);
    };
  },
  onNavigateHistoryForward: (callback: VoidFunction) => {
    const handler = () => callback();
    ipcRenderer.on('navigate:history-forward', handler);
    return () => {
      ipcRenderer.removeListener('navigate:history-forward', handler);
    };
  },
  onWebviewReload: (callback: VoidFunction) => {
    const handler = () => callback();
    ipcRenderer.on('webview:reload', handler);
    return () => {
      ipcRenderer.removeListener('webview:reload', handler);
    };
  },
  onTabClose: (callback: VoidFunction) => {
    const handler = () => callback();
    ipcRenderer.on('tab:close', handler);
    return () => {
      ipcRenderer.removeListener('tab:close', handler);
    };
  },
  onTabNew: (callback: VoidFunction) => {
    const handler = () => callback();
    ipcRenderer.on('tab:new', handler);
    return () => {
      ipcRenderer.removeListener('tab:new', handler);
    };
  },
  onAddressBarFocus: (callback: VoidFunction) => {
    const handler = () => callback();
    ipcRenderer.on('address-bar:focus', handler);
    return () => {
      ipcRenderer.removeListener('address-bar:focus', handler);
    };
  },
  onTabNext: (callback: VoidFunction) => {
    const handler = () => callback();
    ipcRenderer.on('tab:next', handler);
    return () => {
      ipcRenderer.removeListener('tab:next', handler);
    };
  },
  onTabPrev: (callback: VoidFunction) => {
    const handler = () => callback();
    ipcRenderer.on('tab:prev', handler);
    return () => {
      ipcRenderer.removeListener('tab:prev', handler);
    };
  },
  onTabGoto: (callback: (index: number) => void) => {
    const handler = (_: unknown, index: number) => callback(index);
    ipcRenderer.on('tab:goto', handler);
    return () => {
      ipcRenderer.removeListener('tab:goto', handler);
    };
  },
  onFind: (callback: VoidFunction) => {
    const handler = () => callback();
    ipcRenderer.on('edit:find', handler);
    return () => {
      ipcRenderer.removeListener('edit:find', handler);
    };
  },
  onFindNext: (callback: VoidFunction) => {
    const handler = () => callback();
    ipcRenderer.on('edit:find-next', handler);
    return () => {
      ipcRenderer.removeListener('edit:find-next', handler);
    };
  },
  onFindPrevious: (callback: VoidFunction) => {
    const handler = () => callback();
    ipcRenderer.on('edit:find-previous', handler);
    return () => {
      ipcRenderer.removeListener('edit:find-previous', handler);
    };
  },
  // Toggle the Edit → Find / Find Next / Find Previous menu items. The renderer
  // calls this with `true` only while a product webview is on screen — keeps the
  // menu items from being dead clicks on Dashboard / Settings / Chat.
  setFindMenuEnabled: (enabled: boolean) => {
    ipcRenderer.send('menu:set-find-enabled', enabled);
  },
  onZoomIn: (callback: VoidFunction) => {
    const handler = () => callback();
    ipcRenderer.on('view:zoom-in', handler);
    return () => {
      ipcRenderer.removeListener('view:zoom-in', handler);
    };
  },
  onZoomOut: (callback: VoidFunction) => {
    const handler = () => callback();
    ipcRenderer.on('view:zoom-out', handler);
    return () => {
      ipcRenderer.removeListener('view:zoom-out', handler);
    };
  },
  onZoomReset: (callback: VoidFunction) => {
    const handler = () => callback();
    ipcRenderer.on('view:zoom-reset', handler);
    return () => {
      ipcRenderer.removeListener('view:zoom-reset', handler);
    };
  },
  // Toggle the View → Zoom In / Zoom Out / Actual Size menu items. The renderer
  // calls this with `true` only while a product webview is on screen.
  setZoomMenuEnabled: (enabled: boolean) => {
    ipcRenderer.send('menu:set-zoom-enabled', enabled);
  },
  onProductAddToDashboard: (callback: VoidFunction) => {
    const handler = () => callback();
    ipcRenderer.on('product:add-to-dashboard', handler);
    return () => {
      ipcRenderer.removeListener('product:add-to-dashboard', handler);
    };
  },
  setProductDashboardMenuEnabled: (enabled: boolean) => {
    ipcRenderer.send('menu:set-product-dashboard-enabled', enabled);
  },
  onWebviewCrashed: (
    callback: (info: { webContentsId: number; url: string; reason: string; exitCode: number; at: number }) => void,
  ) => {
    const handler = (_: unknown, info: { webContentsId: number; url: string; reason: string; exitCode: number; at: number }) =>
      callback(info);
    ipcRenderer.on(WEBVIEW_RENDER_PROCESS_GONE, handler);
    return () => ipcRenderer.removeListener(WEBVIEW_RENDER_PROCESS_GONE, handler);
  },
  onWebviewUnresponsive: (callback: (info: { webContentsId: number; url: string; at: number }) => void) => {
    const handler = (_: unknown, info: { webContentsId: number; url: string; at: number }) => callback(info);
    ipcRenderer.on(WEBVIEW_RENDER_PROCESS_UNRESPONSIVE, handler);
    return () => ipcRenderer.removeListener(WEBVIEW_RENDER_PROCESS_UNRESPONSIVE, handler);
  },
  onWebviewResponsive: (callback: (info: { webContentsId: number; at: number }) => void) => {
    const handler = (_: unknown, info: { webContentsId: number; at: number }) => callback(info);
    ipcRenderer.on(WEBVIEW_RENDER_PROCESS_RESPONSIVE, handler);
    return () => ipcRenderer.removeListener(WEBVIEW_RENDER_PROCESS_RESPONSIVE, handler);
  },
  onWebviewHealthState: (
    callback: (event: {
      webContentsId: number;
      productId: string | null;
      state: 'healthy' | 'degraded' | 'unresponsive' | 'crashed';
      reason: { kind: string; [key: string]: unknown };
      at: number;
    }) => void,
  ) => {
    const handler = (_: unknown, event: Parameters<typeof callback>[0]) => callback(event);
    ipcRenderer.on(WEBVIEW_HEALTH_STATE, handler);
    return () => ipcRenderer.removeListener(WEBVIEW_HEALTH_STATE, handler);
  },
  sendWebviewVisibility: (webContentsId: number, visible: boolean) =>
    ipcRenderer.invoke('sandbox:visibility', { webContentsId, visible }),
  closeWindow: () => {
    ipcRenderer.send('window:close');
  },
  // Custom window dragging — replaces `-webkit-app-region: drag` on macOS, where
  // right-clicking a native drag region crashes the process (see WindowDragRegion).
  startWindowDrag: () => {
    ipcRenderer.send('window:drag-start');
  },
  endWindowDrag: () => {
    ipcRenderer.send('window:drag-end');
  },
  toggleMaximizeWindow: () => {
    ipcRenderer.send('window:toggle-maximize');
  },
  // Fetch through the main process to bypass renderer CORS. Used by push notifications and by
  // product workers (the renderer gates the URL against remote permissions before calling).
  proxyFetch: (req: ProxyFetchRequest): Promise<ProxyFetchResponse> => {
    return ipcRenderer.invoke('proxyFetch', req);
  },
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  onUpdateEvent: (callback: (event: { type: string; data?: unknown }) => void) => {
    const handler = (_: unknown, event: { type: string; data?: unknown }) => callback(event);
    ipcRenderer.on('app:update-event', handler);
    return () => ipcRenderer.removeListener('app:update-event', handler);
  },
  onCheckForUpdatesRequest: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('app:check-for-updates-request', handler);
    return () => ipcRenderer.removeListener('app:check-for-updates-request', handler);
  },
  quitAndInstall: () => {
    ipcRenderer.send('app:quit-and-install');
  },

  // product management

  saveArchive: async (archive: ProductArchive): Promise<{ success: true } | { success: false; error: string }> => {
    try {
      const init = await ipcRenderer.invoke('initArchive', { domain: archive.domain, origin: archive.origin });
      if (!init.success) return init;

      for (const [filePath, content] of Object.entries(archive.files)) {
        const result = await ipcRenderer.invoke('saveArchiveFile', { domain: archive.domain, filePath, content });
        if (!result.success) return result;
        await microtask();
      }

      return ipcRenderer.invoke('finalizeArchive', archive.domain);
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return { success: false, error: (e as Error).message };
    }
  },
  persistArchive: async (
    archive: ProductArchive,
    contenthash: string,
  ): Promise<{ success: true } | { success: false; error: string }> => {
    try {
      const init = await ipcRenderer.invoke('initArchive', { domain: archive.domain, origin: archive.origin });
      if (!init.success) return init;
      for (const [filePath, content] of Object.entries(toArchiveBytes(archive.files))) {
        const result = await ipcRenderer.invoke('saveArchiveFile', { domain: archive.domain, filePath, content });
        if (!result.success) return result;
        await microtask();
      }
      return ipcRenderer.invoke('archive:persistToDisk', { domain: archive.domain, contenthash });
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return { success: false, error: (e as Error).message };
    }
  },
  getArchive: async (
    domain: string,
    contenthash: string,
  ): Promise<{ origin: string; files: Record<string, Uint8Array> } | null> => {
    const manifest: { origin: string; paths: string[] } | null = await ipcRenderer.invoke('archive:get:manifest', {
      domain,
      contenthash,
    });
    if (!manifest) return null;
    const files: Record<string, Uint8Array> = {};
    for (const filePath of manifest.paths) {
      const content: Uint8Array | null = await ipcRenderer.invoke('archive:get:file', { domain, contenthash, filePath });
      // A file going missing mid-pull (e.g. evicted concurrently) invalidates the
      // whole archive — fall back to a cache miss rather than launch a partial one.
      if (!content) return null;
      files[filePath] = content;
      await microtask();
    }
    return { origin: manifest.origin, files };
  },
  hasArchive: (domain: string, contenthash: string): Promise<boolean> =>
    ipcRenderer.invoke('archive:has', { domain, contenthash }),
  deleteArchive: (domain: string): Promise<{ success: true } | { success: false; error: string }> =>
    ipcRenderer.invoke('archive:delete', domain),
  listPersistedArchives: (): Promise<{ domain: string; contenthash: string; sizeBytes: number }[]> =>
    ipcRenderer.invoke('archive:list'),
  clearAllArchives: (): Promise<{ success: true } | { success: false; error: string }> => ipcRenderer.invoke('archive:clearAll'),
  clearProductData: (productId: string): Promise<{ success: true } | { success: false; error: string }> => {
    return ipcRenderer.invoke('clearProductData', productId);
  },
  onDevicePermissionRequest: createPreloadRequestHandler<
    { productId: string; permission: DevicePermissionType; executable: ExecutableKind },
    PermissionStatus
  >('devicePermission'),
  onRemotePermissionRequest: createPreloadRequestHandler<RemotePermissionIpcRequest, PermissionStatus>('remotePermission'),
  hasDevicePermission: (productId: string, permission: string): Promise<boolean | null> => {
    return ipcRenderer.invoke('hasDevicePermission', productId, permission);
  },
  setDevicePermission: (productId: string, permission: string, value: boolean): Promise<void> => {
    return ipcRenderer.invoke('setDevicePermission', productId, permission, value);
  },
  removeDevicePermission: (productId: string, permission: string): Promise<void> => {
    return ipcRenderer.invoke('removeDevicePermission', productId, permission);
  },
  hasRemotePermission: (productId: string, permission: string): Promise<boolean | null> => {
    return ipcRenderer.invoke('hasRemotePermission', productId, permission);
  },
  setRemotePermission: (productId: string, permission: string, value: boolean): Promise<void> => {
    return ipcRenderer.invoke('setRemotePermission', productId, permission, value);
  },
  removeRemotePermission: (productId: string, permission: string): Promise<void> => {
    return ipcRenderer.invoke('removeRemotePermission', productId, permission);
  },
  clearProductSandboxData: (productId: string): Promise<void> => {
    return ipcRenderer.invoke('sandbox:clear-data', productId);
  },
};

// Respond to main-process health checks (e.g. after macOS wake)
ipcRenderer.on('app:health-check', () => {
  ipcRenderer.send('app:health-check-response');
});

contextBridge.exposeInMainWorld('App', API);
