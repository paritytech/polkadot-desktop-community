import { clearAppData } from '../helpers/cleanup';
import { type ElectronAppContext } from '../helpers/electron';
import { type E2eEnvironmentId, envToBotNetwork } from '../helpers/environment';
import { errorMessage } from '../helpers/errors';
import { VERY_LONG_TIMEOUT } from '../helpers/timeouts';
import { waitForIdle } from '../helpers/wait';
import { OnboardingPage } from '../page-objects/OnboardingPage';

import { test as baseTest } from './base';

const AUTH_ENVIRONMENT_ID: E2eEnvironmentId = 'nightly';

export type AuthTestFixtures = {
  /**
   * Fresh Electron context per test, already signed in via the signing bot.
   * Composes on top of the test-scoped `electronApp` fixture from base.ts —
   * inherits its userDataDir, retry-video recording, and failure-artifact
   * handling. Sign-in cost per test is ~5–10s for pairing after the first
   * test in the worker; the first one pays ~30–60s for on-chain attest.
   */
  authenticatedApp: ElectronAppContext;
};

async function runSignIn(app: ElectronAppContext, botUrl: string, botUsername: string): Promise<void> {
  const onboarding = new OnboardingPage(app.window);
  await onboarding.selectEnvironment(AUTH_ENVIRONMENT_ID);
  await onboarding.waitForQrCode();
  await onboarding.connectViaBot(botUrl, botUsername);
  await app.window.waitForURL(/dashboard/, { timeout: VERY_LONG_TIMEOUT });
  await waitForIdle(app.window);
}

export const authenticatedTest = baseTest.extend<AuthTestFixtures>({
  authenticatedApp: async ({ electronApp, botUrl, botUsername, botUserSession }, use) => {
    await botUserSession.ensure(envToBotNetwork(AUTH_ENVIRONMENT_ID));

    try {
      await runSignIn(electronApp, botUrl, botUsername);
    } catch (err) {
      // Retry once after a short settle — covers the race where the bot
      // reports attested before on-chain finality fully propagates, leaving
      // the pairing silently unable to redirect to /dashboard.
      console.warn(`[auth] sign-in attempt 1 failed (${errorMessage(err)}); retrying in 10s…`);
      await new Promise(resolve => setTimeout(resolve, 10_000));
      await clearAppData(electronApp.window);
      await runSignIn(electronApp, botUrl, botUsername);
    }

    await use(electronApp);
    // Screenshot/video attach + shutdown all happen in `electronApp`'s teardown.
  },
});

export { expect } from '@playwright/test';
