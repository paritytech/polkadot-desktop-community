import { type BrowserWindow, ipcMain, powerMonitor } from 'electron';

const RESUME_SETTLE_DELAY_MS = 3_000;
const HEALTH_CHECK_TIMEOUT_MS = 5_000;
export const WAKE_CRASH_WINDOW_MS = 10_000;

let lastResumeTimestamp: number | null = null;
let currentWindow: BrowserWindow | null = null;
let listenersRegistered = false;
let pendingHealthCheckTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingHealthCheckHandler: (() => void) | null = null;

export function getLastResumeTimestamp(): number | null {
  return lastResumeTimestamp;
}

/**
 * Registers powerMonitor suspend/resume listeners and attaches a health-check
 * ping to detect unresponsive renderers after wake.
 *
 * Idempotent: calling again with a new window updates the reference without
 * re-registering listeners.
 */
export function setupPowerMonitor(window: BrowserWindow): void {
  currentWindow = window;

  if (listenersRegistered) return;
  listenersRegistered = true;

  powerMonitor.on('suspend', () => {
    console.info('System suspending');
  });

  powerMonitor.on('resume', () => {
    lastResumeTimestamp = Date.now();
    console.info('System resuming');

    setTimeout(performHealthCheck, RESUME_SETTLE_DELAY_MS);
  });
}

function cancelPendingHealthCheck(): void {
  if (pendingHealthCheckTimeout !== null) {
    clearTimeout(pendingHealthCheckTimeout);
    pendingHealthCheckTimeout = null;
  }
  if (pendingHealthCheckHandler !== null) {
    ipcMain.removeListener('app:health-check-response', pendingHealthCheckHandler);
    pendingHealthCheckHandler = null;
  }
}

function performHealthCheck(): void {
  cancelPendingHealthCheck();

  if (!currentWindow || currentWindow.isDestroyed()) {
    console.warn('No active window for post-wake health check');
    return;
  }

  const onResponse = () => {
    clearTimeout(pendingHealthCheckTimeout!);
    pendingHealthCheckTimeout = null;
    pendingHealthCheckHandler = null;
    console.info('Renderer healthy after wake');
  };

  pendingHealthCheckHandler = onResponse;

  pendingHealthCheckTimeout = setTimeout(() => {
    ipcMain.removeListener('app:health-check-response', onResponse);
    pendingHealthCheckTimeout = null;
    pendingHealthCheckHandler = null;

    if (currentWindow && !currentWindow.isDestroyed()) {
      console.warn('Renderer unresponsive after wake, reloading');
      currentWindow.webContents.reload();
    }
  }, HEALTH_CHECK_TIMEOUT_MS);

  ipcMain.once('app:health-check-response', onResponse);

  currentWindow.webContents.send('app:health-check');
}
