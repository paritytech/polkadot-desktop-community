import path from 'path';

import { electronProtocol } from '~config';
import { type BrowserWindow, app } from 'electron';

// True once the renderer has signalled that it is mounted and ready to receive
// protocol-open IPC messages. Before this point every deeplink is stored so
// the renderer can receive it via the flush that happens on the ready signal.
let rendererReady = false;

// Route stored while the renderer is not yet ready. At most one pending link
// is kept — the last one wins.
let pendingDeepLinkRoute: string | null = null;

/**
 * Register the app as the default handler for the polkadot:// protocol.
 *
 * When the app is launched via `electron .` (defaultApp mode) we must pass
 * the current script path as the first argument so that Electron knows which
 * file to re-open when the protocol is activated. This is only needed during
 * development – in a packaged build `process.defaultApp` is undefined/false.
 */
export function registerDeepLinkProtocol() {
  if (!process.defaultApp) {
    app.setAsDefaultProtocolClient(electronProtocol);
  } else if (process.argv.length > 1) {
    const part = process.argv[1] ?? '';
    app.setAsDefaultProtocolClient(electronProtocol, process.execPath, [path.resolve(part)]);
  }
}

/**
 * Scan an argv array for a polkadot:// URL and return it, or null if absent.
 * Used on Windows / Linux where the deep-link is forwarded as a CLI argument.
 */
export function extractDeepLinkFromArgv(argv: string[]): string | null {
  return argv.find(arg => arg.startsWith(`${electronProtocol}://`)) ?? null;
}

/**
 * Called when the renderer signals that it has mounted and registered its
 * `protocol-open` listener. Any stored deeplink is immediately flushed by
 * pushing it as a `protocol-open` message.
 */
export function onRendererReady(mainWindow: BrowserWindow) {
  rendererReady = true;

  if (pendingDeepLinkRoute && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('protocol-open', pendingDeepLinkRoute);
    pendingDeepLinkRoute = null;
  }
}

/**
 * Validate that the URL is a polkadot:// deeplink and deliver it to the renderer.
 *
 * The raw URL (e.g. `polkadot://example.dot/page1`) is sent as-is so the
 * renderer can parse it with `dotNsService.parseDotNsDomain`, which already
 * knows the exact pathname format expected by the router params.
 *
 * Strategy:
 * - If the renderer has not yet signalled ready (cold start — React not mounted,
 *   listener not registered), store the URL. It will be pushed once the
 *   renderer sends the `deeplink-renderer-ready` IPC signal.
 * - If the renderer is already running (warm start), push immediately via the
 *   `protocol-open` IPC channel.
 */
export function processDeepLink(url: string, mainWindow: BrowserWindow) {
  if (!url.startsWith(`${electronProtocol}://`)) return;

  if (mainWindow.isDestroyed()) return;

  if (rendererReady) {
    mainWindow.webContents.send('protocol-open', url);
  } else {
    pendingDeepLinkRoute = url;
  }
}

/**
 * Register OS-level deep-link event handlers. Call this early, before
 * `app.whenReady()`, so that the handlers are in place for all activation
 * scenarios.
 *
 * Platform notes
 * ──────────────
 * macOS  – The OS delivers deep links via the `open-url` app event both on
 *           cold start and when the app is already running. On cold start the
 *           renderer is not yet mounted so the route is stored and flushed
 *           when `onRendererReady` is called.
 *
 * Windows / Linux – The OS launches a second instance of the app with the
 *           deep-link URL in its argv. `app.requestSingleInstanceLock()`
 *           (called in `runAppSingleInstance`) prevents the second instance
 *           from opening; instead, the already-running instance receives the
 *           `second-instance` event containing the new argv. Additionally, on
 *           a cold start the URL is already present in the initial
 *           `process.argv` — handle that with `extractDeepLinkFromArgv` after
 *           window creation and call `processDeepLink` directly.
 *
 * @param getMainWindow - A getter that returns the current main window or null.
 *   Using a getter (rather than a direct reference) lets us register the
 *   handlers before the window is instantiated.
 */
export function setupDeepLinkHandlers(getMainWindow: () => BrowserWindow | null) {
  // macOS: fired for both cold-start and warm-start deep links.
  app.on('open-url', (event, url) => {
    event.preventDefault();
    const mainWindow = getMainWindow();
    if (mainWindow) {
      processDeepLink(url, mainWindow);
    } else {
      // Window not created yet — store the raw URL directly.
      if (url.startsWith(`${electronProtocol}://`)) pendingDeepLinkRoute = url;
    }
  });

  // Windows / Linux: the second instance forwards its argv here.
  app.on('second-instance', (_event, argv) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return;

    // Bring the window to the foreground.
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();

    const url = extractDeepLinkFromArgv(argv);
    if (url) processDeepLink(url, mainWindow);
  });
}
