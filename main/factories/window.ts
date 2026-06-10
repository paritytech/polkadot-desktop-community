import { join } from 'path';

import { main, renderer, title } from '~config';
import { BrowserWindow, Menu, session, shell } from 'electron';
import windowStateKeeper from 'electron-window-state';

import { ENVIRONMENT } from '../shared/constants/environment';
import { PLATFORM } from '../shared/constants/platform';

import { buildMenuTemplate } from './menu';

// Google APIs (Firebase Installations / Remote Config) echo the request Origin
// into Access-Control-Allow-Origin; if the global strip below removed it they'd
// omit ACAO and the renderer's CORS check would reject the response.
function isOriginEchoingHost(url: string): boolean {
  try {
    return new URL(url).host.endsWith('.googleapis.com');
  } catch {
    return false;
  }
}

export function createWindow(): BrowserWindow {
  const mainWindowState = windowStateKeeper({
    defaultWidth: main.window.defaultWidth,
    defaultHeight: main.window.defaultHeight,
  });

  const window = new BrowserWindow({
    title,
    x: mainWindowState.x,
    y: mainWindowState.y,
    minWidth: main.window.width,
    minHeight: main.window.height,
    width: Math.max(mainWindowState.width, main.window.width),
    height: Math.max(mainWindowState.height, main.window.height),
    show: false,
    center: true,
    autoHideMenuBar: true,

    titleBarStyle: PLATFORM.IS_MAC ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },

    webPreferences: {
      webviewTag: true,
      nodeIntegration: false,
      preload: join(__dirname, 'preload.cjs'),
    },
  });

  if (ENVIRONMENT.RENDERER_SOURCE === 'localhost') {
    window.loadURL(`${renderer.server.protocol}${renderer.server.host}:${renderer.server.port}`);
  } else {
    window.loadURL('file://' + __dirname + '/index.html');
  }

  // DevTools available via menu: Developer → Toggle Developer Tools (CmdOrCtrl+Shift+I)

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = 'Polkadot Desktop';
    // Stripping Origin is a CORS bypass for third-party RPC / product endpoints
    // that reject the Electron origin. But origin-echoing hosts (Google/Firebase)
    // need it — keep Origin for them, strip it everywhere else.
    if (!isOriginEchoingHost(details.url)) {
      delete details.requestHeaders['Origin'];
    }
    callback({ requestHeaders: details.requestHeaders });
  });

  // Open urls in the user's browser — only allow https
  window.webContents.setWindowOpenHandler(details => {
    try {
      const parsed = new URL(details.url);
      if (parsed.protocol === 'https:') {
        shell.openExternal(parsed.href);
      } else {
        console.warn('[window] Blocked shell.openExternal for:', details.url);
      }
    } catch {
      console.warn('[window] Invalid URL for shell.openExternal:', details.url);
    }

    return { action: 'deny' };
  });

  const syncFullscreenState = () => {
    if (window.isDestroyed()) return;
    window.webContents.send('fullscreen-change', window.isFullScreen());
  };

  window.on('enter-full-screen', syncFullscreenState);
  window.on('leave-full-screen', syncFullscreenState);
  window.on('show', syncFullscreenState);
  window.webContents.on('did-finish-load', syncFullscreenState);

  window.on('focus', () => {
    window.webContents.send('window-focus-change', true);
  });

  window.on('blur', () => {
    window.webContents.send('window-focus-change', false);
  });

  window.on('ready-to-show', () => {
    if (!window) {
      throw new Error('"MainWindow" is not defined');
    }

    window.show();
  });

  window.on('close', () => {
    for (const w of BrowserWindow.getAllWindows()) {
      w.destroy();
    }
  });

  window.on('closed', window.destroy);

  Menu.setApplicationMenu(buildMenuTemplate(window));
  mainWindowState.manage(window);
  window.show();

  return window;
}
