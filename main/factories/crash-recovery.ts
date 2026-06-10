import { readdirSync } from 'fs';

import * as Sentry from '@sentry/electron/main';
import { type BrowserWindow, app, dialog, shell } from 'electron';

import { WAKE_CRASH_WINDOW_MS, getLastResumeTimestamp } from './power-monitor';

const MAX_CRASHES = 3;
const CRASH_WINDOW_MS = 60_000;

const crashTimestamps: number[] = [];
let isDialogOpen = false;

/**
 * Records a crash and returns true if crashing excessively
 * (more than MAX_CRASHES within CRASH_WINDOW_MS).
 */
function recordCrash(): boolean {
  const now = Date.now();
  crashTimestamps.push(now);

  // Keep only crashes within the time window
  while (crashTimestamps.length > 0 && now - crashTimestamps[0]! > CRASH_WINDOW_MS) {
    crashTimestamps.shift();
  }

  return crashTimestamps.length > MAX_CRASHES;
}

/**
 * Attach render-process-gone and unresponsive handlers to a BrowserWindow.
 * Call this for every new window (initial + macOS activate recreations).
 */
export function setupWindowCrashRecovery(window: BrowserWindow): void {
  window.webContents.on('render-process-gone', async (_event, details) => {
    if (details.reason === 'clean-exit') return;

    console.error(`Renderer process gone: reason=${details.reason}, exitCode=${details.exitCode}`);
    Sentry.captureException(new Error(`Renderer process gone: reason=${details.reason}, exitCode=${details.exitCode}`));

    const resumeTs = getLastResumeTimestamp();
    const isWakeCrash = resumeTs !== null && Date.now() - resumeTs < WAKE_CRASH_WINDOW_MS;
    const excessive = recordCrash();

    if (isWakeCrash && !excessive && !window.isDestroyed()) {
      console.warn('Crash detected shortly after wake, auto-reloading');
      window.webContents.reload();
      return;
    }

    if (isDialogOpen || window.isDestroyed()) return;
    isDialogOpen = true;

    try {
      if (excessive) {
        const { response } = await dialog.showMessageBox(window, {
          type: 'error',
          title: 'Application Error',
          message: 'The application has crashed repeatedly and cannot recover.',
          detail: 'Please restart the application manually.\nSharing logs with developers will help resolve this issue.',
          buttons: ['Quit', 'Download Logs'],
          defaultId: 0,
        });

        if (response === 1) {
          openLogsDirectory();
        }

        app.quit();

        return;
      }

      const { response } = await dialog.showMessageBox(window, {
        type: 'error',
        title: 'Application Error',
        message: getReasonMessage(details.reason),
        detail: 'Would you like to reload the application?\nSharing logs with developers will help resolve this issue.',
        buttons: ['Reload', 'Quit', 'Download Logs'],
        defaultId: 0,
        cancelId: 1,
      });

      if (response === 0) {
        window.webContents.reload();
      } else if (response === 2) {
        openLogsDirectory();
        window.webContents.reload();
      } else {
        app.quit();
      }
    } finally {
      isDialogOpen = false;
    }
  });

  window.webContents.on('unresponsive', async () => {
    console.warn('Renderer process is unresponsive');

    if (isDialogOpen || window.isDestroyed()) return;
    isDialogOpen = true;

    try {
      const { response } = await dialog.showMessageBox(window, {
        type: 'warning',
        title: 'Application Not Responding',
        message: 'The application is not responding.',
        detail: 'Would you like to wait or reload?',
        buttons: ['Wait', 'Reload'],
        defaultId: 0,
        cancelId: 0,
      });

      if (response === 1 && !window.isDestroyed()) {
        window.webContents.reload();
      }
    } finally {
      isDialogOpen = false;
    }
  });

  window.webContents.on('responsive', () => {
    console.info('Renderer process recovered');
  });
}

/**
 * Register app-level child-process-gone handler.
 * Call once during app initialization.
 */
export function setupAppCrashMonitoring(): void {
  app.on('child-process-gone', (_event, details) => {
    if (details.reason === 'clean-exit') return;

    const message = `Child process gone: type=${details.type}, reason=${details.reason}, exitCode=${details.exitCode}`;
    console.error(message);
    Sentry.captureException(new Error(message));
  });
}

function openLogsDirectory(): void {
  const logsDir = app.getPath('logs');
  const logFiles = readdirSync(logsDir).filter(f => f.endsWith('.log'));
  const mainLog = logFiles.find(f => f === 'polkadot-desktop.log');

  if (mainLog) {
    shell.showItemInFolder(`${logsDir}/${mainLog}`);
  } else {
    shell.openPath(logsDir);
  }
}

function getReasonMessage(reason: string): string {
  switch (reason) {
    case 'crashed':
      return 'The application has crashed unexpectedly.';
    case 'killed':
      return 'The application process was terminated.';
    case 'oom':
      return 'The application ran out of memory.';
    case 'abnormal-exit':
      return 'The application exited unexpectedly.';
    case 'launch-failure':
      return 'The application failed to start.';
    case 'integrity-failure':
      return 'Application code integrity check failed.';
    default:
      return `The application encountered an error (${reason}).`;
  }
}
