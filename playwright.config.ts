import 'dotenv/config';

import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const sharedSteps = ['./e2e/steps/**/*.ts', './e2e/fixtures/base.ts'];

// Smoke tests — no auth, fresh Electron per test
const bddSmokeDir = defineBddConfig({
  outputDir: '.features-gen/smoke',
  features: [
    './e2e/features/app-launch.feature',
    './e2e/features/onboarding.feature',
    './e2e/features/main-view.feature',
    './e2e/features/address-bar.feature',
    './e2e/features/sandbox-health.feature',
  ],
  steps: sharedSteps,
});

// Link-navigation tests — no auth, fresh Electron per test, uses local HTTP fixture
const bddLinkNavDir = defineBddConfig({
  outputDir: '.features-gen/link-nav',
  features: ['./e2e/features/link-navigation.feature'],
  steps: [
    './e2e/steps/app.steps.ts',
    './e2e/steps/onboarding.steps.ts',
    './e2e/steps/link-navigation.steps.ts',
    './e2e/fixtures/link-tests.ts',
  ],
});

// Auth flow tests — sign-in & logout, fresh Electron per test
const bddAuthDir = defineBddConfig({
  outputDir: '.features-gen/auth',
  features: ['./e2e/features/sign-in.feature'],
  steps: [...sharedSteps, './e2e/steps/auth.steps.ts'],
});

// Authenticated tests — worker-scoped session, sign-in once
const bddAuthenticatedDir = defineBddConfig({
  outputDir: '.features-gen/authenticated',
  features: [
    './e2e/features/authenticated-session.feature',
    './e2e/features/tab-switching.feature',
    './e2e/features/appearance.feature',
    './e2e/features/offline-access.feature',
  ],
  steps: [
    './e2e/steps/authenticated.steps.ts',
    './e2e/steps/tab-switching.steps.ts',
    './e2e/steps/appearance.steps.ts',
    './e2e/steps/offline-access.steps.ts',
    './e2e/fixtures/authenticated.ts',
  ],
});

// Chat tests — all chat features grouped as one project, under e2e/features/chat/
//  - chat-p2p.feature        single Electron, contact search against bot peer (uses authenticatedTest)
//  - chat-p2p-pair.feature   two Electrons (Alice + Bob) full P2P flow (uses chatPairTest)
//  - coinflip-chat.feature   CoinFlip product widget + dashboard chat integration (uses authenticatedTest)
const bddChatDir = defineBddConfig({
  outputDir: '.features-gen/chat',
  features: ['./e2e/features/chat/*.feature'],
  steps: [
    './e2e/steps/authenticated.steps.ts',
    './e2e/steps/chat-p2p.steps.ts',
    './e2e/steps/chat-p2p-pair.steps.ts',
    './e2e/steps/coinflip-chat.steps.ts',
    './e2e/fixtures/authenticated.ts',
    './e2e/fixtures/chatPair.ts',
  ],
});

// Product SDK tests — host-playground sandbox + product-integration features (Accounts, Signing, etc.)
const bddProductSdkDir = defineBddConfig({
  outputDir: '.features-gen/product-sdk',
  features: ['./e2e/features/product-sdk/*.feature'],
  steps: ['./e2e/steps/authenticated.steps.ts', './e2e/steps/test-product-sdk.steps.ts', './e2e/fixtures/test-product-sdk.ts'],
});

/**
 * Playwright configuration for Electron E2E tests.
 *
 * Projects:
 *   smoke — no auth
 *   auth, authenticated, product-sdk, chat — depend on `setup-bot-users`;
 *     `teardown-bot-users` runs after all dependents complete.
 *   security — independent.
 *
 * `workers: 1` globally — Electron apps are heavy, parallel workers conflict.
 * Signing projects get fresh Electron + temp userDataDir per test; chat-pair
 * scenarios share Alice/Bob Electrons across tests in a worker via chatPair.ts.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e/tests',

  // Wipe stale bot-user pool file at the start of every invocation so per-project
  // setups merge into a clean slate (see e2e/setup/global-init.ts).
  globalSetup: './e2e/setup/global-init.ts',

  // Maximum time one test can run
  timeout: 60_000,

  // Maximum time to wait for test.expect()
  expect: {
    timeout: 5_000,
  },

  // Electron tests must run sequentially — each test launches its own app
  fullyParallel: false,
  workers: 1,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env['CI'],

  // Retry on CI only
  retries: process.env['CI'] ? 1 : 0,

  // Reporter to use
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    [
      'junit',
      {
        outputFile: 'test-results/junit.xml',
      },
    ],
    [
      'allure-playwright',
      {
        outputFolder: 'allure-results',
        detail: true,
        suiteTitle: false,
        environmentInfo: {
          node_version: process.version,
          platform: process.platform,
          runner_os: process.env['RUNNER_OS'] ?? process.platform,
          architecture: process.arch,
          github_run_id: process.env['GITHUB_RUN_ID'],
          github_run_number: process.env['GITHUB_RUN_NUMBER'],
          github_ref: process.env['GITHUB_REF_NAME'],
          github_sha: process.env['GITHUB_SHA'],
          ci: process.env['CI'] ?? 'false',
        },
      },
    ],
  ],

  // Shared settings for all the projects below
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // 0. Per-project bot-user setups. Each provisions only the identities its
    //    dependent needs, so `--project=auth` does NOT pay the cost of chat
    //    pairs, `--project=chat` does NOT attest an `authenticated` user, etc.
    //    All of them declare the shared `teardown-bot-users` so cleanup runs
    //    once at the very end regardless of which setups actually executed.
    {
      name: 'setup-auth',
      testMatch: '**/auth.setup.ts',
      testDir: './e2e/setup',
      timeout: 180_000,
      teardown: 'teardown-bot-users',
    },
    {
      name: 'setup-authenticated',
      testMatch: '**/authenticated.setup.ts',
      testDir: './e2e/setup',
      timeout: 180_000,
      teardown: 'teardown-bot-users',
    },
    {
      name: 'setup-product-sdk',
      testMatch: '**/product-sdk.setup.ts',
      testDir: './e2e/setup',
      timeout: 180_000,
      teardown: 'teardown-bot-users',
    },
    {
      name: 'setup-chat',
      testMatch: '**/chat.setup.ts',
      testDir: './e2e/setup',
      // Chat provisions 1 singleton + N pairs (default 6 → 13 users) in parallel;
      // attestation finality polling can take ~60–90s total.
      timeout: 240_000,
      teardown: 'teardown-bot-users',
    },
    {
      name: 'teardown-bot-users',
      testMatch: '**/bot-users.teardown.ts',
      testDir: './e2e/setup',
      timeout: 60_000,
    },

    // 1. Smoke tests — no auth, fresh Electron per test
    {
      name: 'smoke',
      testDir: bddSmokeDir,
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    // 2. Auth flow tests — sign-in & logout, fresh Electron per test
    {
      name: 'auth',
      testDir: bddAuthDir,
      timeout: 180_000,
      dependencies: ['setup-auth'],
      use: {
        ...devices['Desktop Chrome'],
        // @ts-expect-error -- custom fixture option from e2e/fixtures/base.ts
        autotest: true,
      },
    },

    // 3. Authenticated tests — fresh Electron per test, sign in each time.
    //    Higher timeout than auth/product-sdk because tab-switching opens 7
    //    tabs, cycles through them twice (cycle + verify), and dismisses per-
    //    tab permission dialogs — runs ~3 min end-to-end including sign-in.
    {
      name: 'authenticated',
      testDir: bddAuthenticatedDir,
      timeout: 300_000,
      dependencies: ['setup-authenticated'],
      use: {
        ...devices['Desktop Chrome'],
        // @ts-expect-error -- custom fixture option from e2e/fixtures/base.ts
        autotest: true,
      },
    },

    // 4. Product SDK tests — host-playground sandbox tests on authenticated session
    {
      name: 'product-sdk',
      testDir: bddProductSdkDir,
      timeout: 180_000,
      dependencies: ['setup-product-sdk'],
      use: {
        ...devices['Desktop Chrome'],
        // @ts-expect-error -- custom fixture option from e2e/fixtures/base.ts
        autotest: true,
      },
    },

    // 5. Chat tests — all chat flows (single-client contact search + two-client P2P pair)
    {
      name: 'chat',
      testDir: bddChatDir,
      // chat-p2p-pair does two sign-ins + chat handshake round-trips.
      // chat-p2p is much quicker but shares the timeout.
      timeout: 600_000,
      dependencies: ['setup-chat'],
      use: {
        ...devices['Desktop Chrome'],
        // @ts-expect-error -- custom fixture option from e2e/fixtures/base.ts
        autotest: true,
      },
    },

    // 6. Security tests — independent, own fixture system
    {
      name: 'security',
      testDir: './e2e/tests',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: /security\/.*\.e2e\.ts/,
    },

    // 6. Link-navigation tests — independent, uses local HTTP fixture (no auth)
    {
      name: 'link-navigation',
      testDir: bddLinkNavDir,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  // Output folder for test artifacts
  outputDir: 'test-results',
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}{-projectName}{-snapshotSuffix}{ext}',
});
