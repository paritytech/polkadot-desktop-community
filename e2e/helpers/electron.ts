import path from 'path';

import { type ElectronApplication, type Page, _electron as electron } from '@playwright/test';

export type ElectronAppContext = {
  app: ElectronApplication;
  window: Page;
};

/**
 * Launch the Electron application for testing
 */
export async function launchElectronApp(options?: {
  /**
   * Additional arguments to pass to the Electron app
   */
  args?: string[];
  /**
   * Launch with AUTOTEST mode enabled (sets AUTOTEST=true env var)
   */
  autotest?: boolean;
  /**
   * Custom signing bot URL (sets BOT_URL env var)
   */
  botUrl?: string;
  /**
   * Custom signing bot token (sets BOT_TOKEN env var)
   */
  botToken?: string;
  /**
   * Custom user data directory
   */
  userDataDir?: string;
  /**
   * Record a video of the Electron window for the duration of the app.
   * The file is written to `dir` when the app is closed.
   */
  recordVideo?: { dir: string; size?: { width: number; height: number } };
}): Promise<ElectronAppContext> {
  const { args = [], autotest = false, botUrl, botToken, userDataDir, recordVideo } = options ?? {};

  // Path to the Electron main file
  // Using the built file from release/build
  const electronPath = path.join(process.cwd(), 'release/build/main.cjs');

  const appArgs = [...args];

  // Platform-specific Chromium flags for CI stability
  const platformArgs =
    process.platform === 'linux'
      ? [
          // Disable sandbox and use software rendering on Linux (CI has no display/GPU)
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-software-rasterizer',
          '--disable-setuid-sandbox',
        ]
      : process.platform === 'win32'
        ? [
            // Force scale factor to 1 on Windows to prevent DPI scaling from shrinking the viewport
            '--force-device-scale-factor=1',
            '--high-dpi-support=1',
          ]
        : [];

  const electronArgs = [...platformArgs, electronPath, ...appArgs];

  // Set environment variables for test mode
  const env: Record<string, string> = {
    NODE_ENV: 'test',
    E2E_TEST: 'true',
  };

  if (autotest) {
    env['AUTOTEST'] = 'true';
  }

  if (botUrl) {
    env['BOT_URL'] = botUrl;
  }

  if (botToken) {
    env['BOT_TOKEN'] = botToken;
  }

  if (userDataDir) {
    env['ELECTRON_USER_DATA'] = userDataDir;
  }

  // Launch Electron — only pass defined env vars (Playwright expects Record<string, string>)
  const baseEnv = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  const app = await electron.launch({
    args: electronArgs,
    env: {
      ...baseEnv,
      ...env,
    },
    timeout: 15000,
    ...(recordVideo ? { recordVideo } : {}),
  });

  // Wait for the first window to open with timeout
  const window = await app.firstWindow({
    timeout: 15000,
  });

  // Ensure consistent window size across platforms (Windows has larger chrome)
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.setContentSize(1372, 800);
      win.center();
    }
  });

  // Wait for the app to be ready
  await window.waitForLoadState('domcontentloaded');

  return { app, window };
}

/**
 * Close the Electron application
 */
export async function closeElectronApp(context: ElectronAppContext): Promise<void> {
  await context.app.close();
}

/**
 * If the Electron was launched with `recordVideo`, waits for the video file to
 * be finalized (happens on app close) and returns its path. Returns null if no
 * video was recorded or if retrieval fails.
 *
 * Must be called AFTER `closeElectronApp` (video is only written on close).
 */
export async function getRecordedVideoPath(context: ElectronAppContext): Promise<string | null> {
  try {
    const video = context.window.video();
    if (!video) return null;
    return await video.path();
  } catch {
    return null;
  }
}

/**
 * Get all windows from the Electron application
 */
export function getWindows(app: ElectronApplication): Page[] {
  return app.windows();
}

/**
 * Wait for a new window to be created
 */
export async function waitForNewWindow(app: ElectronApplication, trigger: () => Promise<void>): Promise<Page> {
  const windowPromise = app.waitForEvent('window');
  await trigger();
  return await windowPromise;
}

/**
 * Get the main process evaluation result
 */
export async function evaluateInMainProcess<T>(app: ElectronApplication, fn: () => T): Promise<T> {
  return await app.evaluate(fn);
}

/**
 * Get application version
 */
export async function getAppVersion(app: ElectronApplication): Promise<string> {
  return await app.evaluate(({ app }) => app.getVersion());
}

/**
 * Get application name
 */
export async function getAppName(app: ElectronApplication): Promise<string> {
  return await app.evaluate(({ app }) => app.getName());
}

/**
 * Check if app is packaged
 */
export async function isPackaged(app: ElectronApplication): Promise<boolean> {
  return await app.evaluate(({ app }) => app.isPackaged);
}

/**
 * Set the main window fullscreen state and wait for the transition to complete
 */
export async function setFullScreen(app: ElectronApplication, fullscreen: boolean): Promise<void> {
  await app.evaluate(({ BrowserWindow }, fs: boolean) => {
    return new Promise<void>(resolve => {
      const win = BrowserWindow.getAllWindows()[0];
      if (!win) throw new Error('No window found');

      if (win.isFullScreen() === fs) {
        resolve();
        return;
      }

      if (fs) {
        win.once('enter-full-screen', () => resolve());
      } else {
        win.once('leave-full-screen', () => resolve());
      }
      win.setFullScreen(fs);
    });
  }, fullscreen);
}

/**
 * Simulate app menu click
 */
export async function clickMenuItem(app: ElectronApplication, ...menuPath: string[]): Promise<void> {
  await app.evaluate(({ Menu }, path: string[]) => {
    const menu = Menu.getApplicationMenu();
    if (!menu) throw new Error('No application menu found');

    let currentItem = menu.items;
    for (const label of path) {
      const item = currentItem.find(i => i.label === label);
      if (!item) throw new Error(`Menu item "${label}" not found`);
      if (item.submenu) {
        currentItem = item.submenu.items;
      } else {
        item.click();
        break;
      }
    }
  }, menuPath);
}
