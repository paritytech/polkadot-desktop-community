import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { test as bddTest } from 'playwright-bdd';

import { e2eConfig } from '../config';
import { attachFailureScreenshot, attachRecordedVideo, shutdownElectronApp } from '../helpers/artifacts';
import { BotUserSession, makeBotUsername } from '../helpers/bot-user';
import { clearAppData } from '../helpers/cleanup';
import { registerProductDialogHandlers } from '../helpers/dialogs';
import { type ElectronAppContext, launchElectronApp } from '../helpers/electron';
import { isPoolRole, readPoolUser } from '../setup/bot-user-pool';

import { setupPlatformParameter } from './allure-metadata';

export type TestFixtures = {
  /**
   * Electron app context with app instance and main window
   */
  electronApp: ElectronAppContext;

  /**
   * Temporary user data directory for this test
   */
  userDataDir: string;

  /**
   * Whether to launch with AUTOTEST mode (default: false)
   */
  autotest: boolean;
};

export type WorkerFixtures = {
  /**
   * Signing-bot username for this project, random per worker.
   * Set via `use: { botUsername: makeBotUsername() }` in playwright.config.ts.
   */
  botUsername: string;

  /**
   * Signing-bot base URL. Overridable via env in `e2eConfig`.
   */
  botUrl: string;

  /**
   * Worker-scoped bot-user session — create/attest on demand, DELETE on teardown.
   * Shared across all tests in the worker so repeated sign-ins on the same network
   * don't re-attest (30–60s on-chain cost).
   */
  botUserSession: BotUserSession;

  /**
   * Worker-scoped fixture for shared setup
   */
  workerFixture: void;
};

/**
 * Extended test with custom fixtures
 */
export const test = bddTest.extend<TestFixtures, WorkerFixtures>({
  // Per-project bot identity from the pool provisioned by `setup-bot-users`.
  // Fallback is a random name + on-the-fly attest via `ensure()` — only hit
  // when running without the setup project (local debugging).
  botUsername: [
    // eslint-disable-next-line no-empty-pattern -- Playwright fixture signature requires destructuring
    async ({}, use, workerInfo) => {
      const name = workerInfo.project.name;
      const pooled = isPoolRole(name) ? await readPoolUser(name) : undefined;
      await use(pooled ?? makeBotUsername());
    },
    { scope: 'worker' },
  ],

  botUrl: [e2eConfig.botUrl, { option: true, scope: 'worker' }],

  // Worker-scoped session: creates+attests on demand for fallback mode; cleanup
  // is centralised in the `teardown-bot-users` project (skipped here).
  botUserSession: [
    async ({ botUsername, botUrl }, use) => {
      const session = new BotUserSession(botUsername, botUrl, process.env['BOT_TOKEN']);
      await use(session);
      // Cleanup handled by the global teardown project; no per-worker DELETE.
    },
    { scope: 'worker' },
  ],

  // Worker fixture - runs once per worker
  workerFixture: [
    // eslint-disable-next-line no-empty-pattern -- Playwright requires object destructuring; no deps needed
    async ({}, use) => {
      // Setup worker-level resources
      console.info('🔧 Setting up worker...');
      await use();
      console.info('🧹 Cleaning up worker...');
    },
    { scope: 'worker' },
  ],

  // Autotest mode flag
  autotest: [false, { option: true }],

  // User data directory - creates a temporary directory for each test
  // eslint-disable-next-line no-empty-pattern -- Playwright requires object destructuring; no deps needed
  userDataDir: async ({}, use, testInfo) => {
    const tmpDir = path.join(os.tmpdir(), 'polkadot-desktop-e2e', `test-${testInfo.workerIndex}-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });

    await use(tmpDir);

    // Cleanup
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup temp dir ${tmpDir}:`, error);
    }
  },

  // Electron app fixture
  electronApp: async ({ userDataDir, autotest }, use, testInfo) => {
    await setupPlatformParameter();
    const isRetry = testInfo.retry > 0;
    console.info(
      `🚀 Launching Electron app for test: ${testInfo.title} (autotest: ${autotest}${isRetry ? `, retry #${testInfo.retry}, recording video` : ''})`,
    );

    const videoDir = isRetry ? path.join(testInfo.outputDir, 'video') : undefined;
    if (videoDir) await fs.mkdir(videoDir, { recursive: true });

    const context = await launchElectronApp({
      userDataDir,
      autotest,
      botToken: process.env['BOT_TOKEN'],
      ...(videoDir ? { recordVideo: { dir: videoDir } } : {}),
    });

    // Clean slate — clear all storage before test actions
    await clearAppData(context.window);

    // Auto-approve transient product dialogs (permission requests, alias
    // requests) for the lifetime of this main page, so tests don't need to
    // know which products may pop them or when. Tests that need to assert on
    // the dialogs themselves opt out with the `@manual-permissions` Gherkin
    // tag in their .feature file.
    if (!testInfo.tags.includes('@manual-permissions')) {
      await registerProductDialogHandlers(context.window);
    }

    try {
      await use(context);
    } finally {
      await attachFailureScreenshot(context, testInfo);
      console.info(`🔚 Closing Electron for test: ${testInfo.title}`);
      await shutdownElectronApp(context);
      if (videoDir) await attachRecordedVideo(context, testInfo);
    }
  },
});

export { expect } from '@playwright/test';
