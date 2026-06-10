import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { type TestInfo } from '@playwright/test';
import { test as bddTest } from 'playwright-bdd';

import { e2eConfig } from '../config';
import { shutdownElectronApp } from '../helpers/artifacts';
import { BotUserSession, generateBotUsername } from '../helpers/bot-user';
import { clearAppData } from '../helpers/cleanup';
import { type ElectronAppContext, launchElectronApp } from '../helpers/electron';
import { type E2eEnvironmentId, envToBotNetwork } from '../helpers/environment';
import { errorMessage } from '../helpers/errors';
import { VERY_LONG_TIMEOUT } from '../helpers/timeouts';
import { waitForIdle } from '../helpers/wait';
import { OnboardingPage } from '../page-objects/OnboardingPage';
import { readPool } from '../setup/bot-user-pool';

import { setupPlatformParameter } from './allure-metadata';

const CHAT_PAIR_ENVIRONMENT_ID: E2eEnvironmentId = 'paseo-next-v2';
const CHAT_PAIR_BOT_NETWORK = envToBotNetwork(CHAT_PAIR_ENVIRONMENT_ID);

/**
 * A paired identity — one authenticated Electron instance plus its bot username
 * (the username another user needs in order to start a chat via the contact search).
 */
export type PairIdentity = {
  app: ElectronAppContext;
  botUsername: string;
};

type PairAssignment = { alice: string; bob: string };

export type ChatPairWorkerFixtures = {
  chatPairPool: PairAssignment[];
  chatPairCounter: { value: number };
};

export type ChatPairTestFixtures = {
  pairAssignment: PairAssignment;
  aliceUserDataDir: string;
  bobUserDataDir: string;
  aliceContext: PairIdentity;
  bobContext: PairIdentity;
  alice: PairIdentity;
  bob: PairIdentity;
};

async function createTempDir(prefix: string): Promise<string> {
  const dir = path.join(os.tmpdir(), 'polkadot-desktop-e2e', `${prefix}-${Date.now()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function cleanupTempDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Failed to cleanup temp dir ${dir}:`, error);
  }
}

async function signInOnce(opts: { userDataDir: string; botUsername: string; botUrl: string }): Promise<ElectronAppContext> {
  const context = await launchElectronApp({
    userDataDir: opts.userDataDir,
    autotest: true,
    botToken: process.env['BOT_TOKEN'],
  });
  try {
    await clearAppData(context.window);
    await waitForIdle(context.window);
    const onboarding = new OnboardingPage(context.window);
    await onboarding.selectEnvironment(CHAT_PAIR_ENVIRONMENT_ID);
    await onboarding.waitForQrCode();
    await onboarding.connectViaBot(opts.botUrl, opts.botUsername);
    await context.window.waitForURL(/dashboard/, { timeout: VERY_LONG_TIMEOUT });
    await waitForIdle(context.window);
    return context;
  } catch (err) {
    // If anything in the flow throws, tear down this Electron so the caller
    // can relaunch fresh (state reset, new pairing session).
    await shutdownElectronApp(context).catch(() => {});
    throw err;
  }
}

/**
 * Sign in with one retry. The bot occasionally reports `attested: true` before
 * on-chain finality has propagated; the next `waitForURL(/dashboard/)` then
 * times out because the bot can't sign with a non-finalized identity. A full
 * Electron relaunch after a short settle delay gives the chain time to catch up.
 */
async function signIn(opts: {
  userDataDir: string;
  botUsername: string;
  botUrl: string;
  label: string;
}): Promise<ElectronAppContext> {
  try {
    return await signInOnce(opts);
  } catch (err) {
    console.warn(`[${opts.label}] sign-in attempt 1 failed (${errorMessage(err)}); retrying in 10s…`);
    await new Promise(resolve => setTimeout(resolve, 10_000));
    return signInOnce(opts);
  }
}

async function buildPairContext(opts: { label: string; userDataDir: string; botUsername: string }): Promise<PairIdentity> {
  const botToken = process.env['BOT_TOKEN'];
  // Pool pre-attested the identity; ensure() is a fast POST confirming the
  // user exists and is attested, so this stays a no-op unless we're running
  // in fallback mode (no pool).
  const session = new BotUserSession(opts.botUsername, e2eConfig.botUrl, botToken);
  console.info(`🔐 [${opts.label}] Ensuring bot user "${opts.botUsername}"@${CHAT_PAIR_BOT_NETWORK}...`);
  await session.ensure(CHAT_PAIR_BOT_NETWORK);
  console.info(`🔐 [${opts.label}] Launching & signing in as "${opts.botUsername}"...`);
  const app = await signIn({
    userDataDir: opts.userDataDir,
    botUsername: opts.botUsername,
    botUrl: e2eConfig.botUrl,
    label: opts.label,
  });
  console.info(`✅ [${opts.label}] Ready. username = "${opts.botUsername}"`);
  return { app, botUsername: opts.botUsername };
}

async function attachPairScreenshot(identity: PairIdentity, testInfo: TestInfo, label: string): Promise<void> {
  if (testInfo.status === testInfo.expectedStatus) return;
  try {
    const shot = await identity.app.window.screenshot();
    if (shot) await testInfo.attach(`${label}-screenshot`, { body: shot, contentType: 'image/png' });
  } catch {
    // Window may be closed — best-effort.
  }
}

export const chatPairTest = bddTest.extend<ChatPairTestFixtures, ChatPairWorkerFixtures>({
  // Worker-scoped: pre-attested pair pool loaded once from the setup project.
  // Each pair is consumed by at most one test so on-chain state never bleeds
  // between scenarios.
  chatPairPool: [
    // eslint-disable-next-line no-empty-pattern -- Playwright fixture signature requires destructuring
    async ({}, use) => {
      const pool = await readPool();
      await use(pool?.chatPairs ?? []);
    },
    { scope: 'worker' },
  ],

  // Worker-scoped counter: advances on every test (including retries, which
  // must get a fresh slot to avoid inheriting polluted on-chain state from the
  // prior attempt).
  chatPairCounter: [
    // eslint-disable-next-line no-empty-pattern -- Playwright fixture signature requires destructuring
    async ({}, use) => {
      await use({ value: 0 });
    },
    { scope: 'worker' },
  ],

  // Test-scoped: assigns the next slot to this test. Fallback to a freshly
  // generated pair when the pool is exhausted — useful in local `playwright
  // test --ignore-project-dependencies` runs and as a safety net for
  // unexpectedly high retry counts. The fallback pays the ~30–60s attest cost
  // per side synchronously, so pool exhaustion is loud.
  pairAssignment: async ({ chatPairPool, chatPairCounter }, use) => {
    const index = chatPairCounter.value++;
    const slot = chatPairPool[index];
    if (slot) {
      await use(slot);
      return;
    }
    console.warn(
      `[chatPair] Pool slot ${index} missing (pool size ${chatPairPool.length}); falling back to fresh pair. ` +
        `Bump CHAT_PAIR_POOL_SIZE if this isn't a fallback-mode run.`,
    );
    await use({ alice: generateBotUsername(), bob: generateBotUsername() });
  },

  // eslint-disable-next-line no-empty-pattern -- Playwright fixture signature requires destructuring
  aliceUserDataDir: async ({}, use) => {
    const dir = await createTempDir('alice');
    await use(dir);
    await cleanupTempDir(dir);
  },

  // eslint-disable-next-line no-empty-pattern -- Playwright fixture signature requires destructuring
  bobUserDataDir: async ({}, use) => {
    const dir = await createTempDir('bob');
    await use(dir);
    await cleanupTempDir(dir);
  },

  aliceContext: async ({ aliceUserDataDir, pairAssignment }, use) => {
    const identity = await buildPairContext({
      label: 'Alice',
      userDataDir: aliceUserDataDir,
      botUsername: pairAssignment.alice,
    });
    await use(identity);
    console.info('🔚 [Alice] Closing…');
    await shutdownElectronApp(identity.app);
  },

  bobContext: async ({ bobUserDataDir, pairAssignment }, use) => {
    const identity = await buildPairContext({
      label: 'Bob',
      userDataDir: bobUserDataDir,
      botUsername: pairAssignment.bob,
    });
    await use(identity);
    console.info('🔚 [Bob] Closing…');
    await shutdownElectronApp(identity.app);
  },

  alice: async ({ aliceContext }, use, testInfo) => {
    await setupPlatformParameter();
    await use(aliceContext);
    await attachPairScreenshot(aliceContext, testInfo, 'alice');
  },

  bob: async ({ bobContext }, use, testInfo) => {
    await use(bobContext);
    await attachPairScreenshot(bobContext, testInfo, 'bob');
  },
});

export { expect } from '@playwright/test';
