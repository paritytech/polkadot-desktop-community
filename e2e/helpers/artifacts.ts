import { type TestInfo } from '@playwright/test';

import { disconnectBotSession } from './cleanup';
import { type ElectronAppContext, closeElectronApp, getRecordedVideoPath } from './electron';
import { errorMessage } from './errors';

/**
 * Best-effort Electron teardown: disconnect bot sessions, then close the app.
 * Never throws — each step logs its own warning and continues, so a failure in
 * one cleanup doesn't abort the next.
 */
export async function shutdownElectronApp(context: ElectronAppContext): Promise<void> {
  await disconnectBotSession(context.window).catch(err =>
    console.warn('[CLEANUP] disconnectBotSession failed:', errorMessage(err)),
  );
  await closeElectronApp(context).catch(err => console.warn('[CLEANUP] closeElectronApp failed:', errorMessage(err)));
}

/**
 * Attach a PNG screenshot of the Electron window to the Allure result when the
 * test has failed. Best-effort: if the window has already been disposed
 * (crashed Electron, earlier `waitFor*` timeout), logs and swallows the error.
 */
export async function attachFailureScreenshot(context: ElectronAppContext, testInfo: TestInfo): Promise<void> {
  if (testInfo.status === testInfo.expectedStatus) return;

  try {
    const screenshot = await context.window.screenshot();
    await testInfo.attach('screenshot', { body: screenshot, contentType: 'image/png' });
  } catch (err) {
    console.warn('[SCREENSHOT] capture failed (window likely closed):', errorMessage(err));
  }
}

/**
 * Attach the recorded `.webm` video to the Allure result.
 *
 * Must be called AFTER `shutdownElectronApp` — Playwright writes the file on
 * app close, so `video().path()` only resolves then.
 */
export async function attachRecordedVideo(context: ElectronAppContext, testInfo: TestInfo): Promise<void> {
  const videoPath = await getRecordedVideoPath(context);
  if (!videoPath) {
    console.warn('[VIDEO] no recorded video path available');
    return;
  }
  await testInfo
    .attach('video', { path: videoPath, contentType: 'video/webm' })
    .catch(err => console.warn('[VIDEO] attach failed:', errorMessage(err)));
}
