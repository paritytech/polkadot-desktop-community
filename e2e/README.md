# E2E Tests

BDD-style end-to-end tests for the Polkadot Desktop Electron app using [Playwright](https://playwright.dev/) and [playwright-bdd](https://github.com/vitalets/playwright-bdd) with Gherkin syntax.

## Architecture

```
                         ┌─────────────────────────────────────────────┐
                         │             playwright.config.ts            │
                         │                                             │
                         │  defineBddConfig() x3 → .features-gen/     │
                         │  projects: smoke → auth → authenticated     │
                         │  workers: 1, sequential execution           │
                         └─────────────┬───────────────────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              ▼                        ▼                        ▼
     ┌────────────────┐     ┌──────────────────┐     ┌──────────────────┐
     │     smoke      │     │      auth        │     │  authenticated   │
     │                │     │                  │     │                  │
     │ app-launch     │     │ sign-in          │     │ authenticated-   │
     │ onboarding     │────▶│ logout           │────▶│ session          │
     │ main-view      │deps │                  │deps │                  │
     │                │     │ Fresh Electron   │     │ Shared Electron  │
     │ Fresh Electron │     │ per test         │     │ Fresh Electron   │
     │ per test       │     │ AUTOTEST=true    │     │ + sign-in        │
     └───────┬────────┘     └────────┬─────────┘     └────────┬─────────┘
             │                       │                         │
             ▼                       ▼                         ▼
     ┌────────────────┐     ┌──────────────────┐     ┌──────────────────┐
     │ fixtures/      │     │ fixtures/        │     │ fixtures/        │
     │ base.ts        │     │ base.ts          │     │ authenticated.ts │
     │                │     │                  │     │                  │
     │ electronApp    │     │ electronApp      │     │ authenticatedApp │
     │ (test-scoped)  │     │ (test-scoped)    │     │ (test-scoped)    │
     └───────┬────────┘     └────────┬─────────┘     └────────┬─────────┘
             │                       │                         │
             └───────────────────────┼─────────────────────────┘
                                     ▼
                          ┌──────────────────────┐
                          │  Electron Process    │
                          │                      │
                          │  clearAppData()      │
                          │  ↓                   │
                          │  Fresh localStorage  │
                          │  Fresh IndexedDB     │
                          │  Unique userDataDir  │
                          └──────────────────────┘
```

## Directory Structure

```
e2e/
├── features/               Gherkin .feature files (test scenarios)
│   ├── app-launch.feature
│   ├── onboarding.feature
│   ├── main-view.feature
│   ├── sign-in.feature
│   ├── logout.feature
│   ├── authenticated-session.feature
│   ├── offline-access.feature
│   ├── chat/                  All chat tests (@chat project)
│   │   ├── chat-p2p.feature           P2P contact search against bot peer
│   │   ├── chat-p2p-pair.feature      Alice + Bob 2-client P2P chat
│   │   └── coinflip-chat.feature      CoinFlip product widget + dashboard chat integration
│   └── product-sdk/           Product SDK test suite (host-playground + product integrations)
│       ├── accounts.feature       Accounts API tests
│       └── signing.feature        Signing API tests
├── steps/                  Step definitions (Given/When/Then implementations)
│   ├── app.steps.ts            App launch steps
│   ├── onboarding.steps.ts     QR code, skip onboarding
│   ├── dashboard.steps.ts      Dashboard, theme, chat, settings, screenshots
│   ├── auth.steps.ts           Sign-in, logout, localStorage checks
│   ├── authenticated.steps.ts  Shared session steps
│   ├── chat-p2p.steps.ts       Contact search vs. bot peer
│   ├── chat-p2p-pair.steps.ts  Alice + Bob 2-client chat actions
│   ├── coinflip-chat.steps.ts  CoinFlip widget add + dashboard chat send (@chat project)
│   ├── offline-access.steps.ts Product actions menu + enable offline access flow
│   └── test-product-sdk.steps.ts  Product SDK shared steps (navigate, run action, confirm signing)
├── page-objects/           Page Object pattern
│   ├── OnboardingPage.ts       QR, skip, signing bot panel
│   ├── DashboardPage.ts        Theme, chat, settings, user button, edit mode, screenshots
│   ├── ChatPage.ts             Chat widget, fullscreen, session selection, message sending, reactions
│   ├── ContactSearchPage.ts    Chat contact search (username/SS58 direct-connect, welcome, send request)
│   ├── UserPopover.ts          Username, logout
│   ├── ProductActionsPage.ts   Product actions menu (•••), offline access confirm, pin indicator
│   └── TestProductPage.ts      Product webview interaction (navigation, categories, actions, signing)
├── fixtures/               Playwright test fixtures
│   ├── base.ts                 Test-scoped Electron (fresh per test)
│   ├── authenticated.ts        Test-scoped Electron + sign-in (composes on electronApp)
│   ├── chatPair.ts             Test-scoped Alice + Bob Electrons drawn from a pool of pre-attested pairs
│   ├── test-product-sdk.ts     Authenticated + TestProductPage fixture
│   └── security.ts             Security probe fixtures
├── helpers/                Utility functions
│   ├── electron.ts             Launch/close Electron, menu clicks
│   ├── cleanup.ts              Clear localStorage, IndexedDB before tests
│   ├── chatBotClient.ts        HTTP client for signing-bot chat API (ensure peer / discovery / send messages)
│   ├── chatState.ts            Reset Dexie p2p-chat DB + navigate to dashboard
│   ├── wait.ts                 Wait utilities (idle, selector, retry)
│   ├── assertions.ts           Custom Playwright assertions
│   └── webview.ts              Product injection for security tests
├── setup/                  Infra projects — per-role pre-provision + shared teardown
│   ├── bot-user-pool.ts       Pool file storage + role constants (zod-validated)
│   ├── bot-users.shared.ts    `provisionRoles()` helper that merges into the pool
│   ├── global-init.ts         `globalSetup` — wipes stale pool file at invocation start
│   ├── auth.setup.ts          Provisions `auth` singleton
│   ├── authenticated.setup.ts Provisions `authenticated` singleton
│   ├── product-sdk.setup.ts   Provisions `product-sdk` singleton
│   ├── chat.setup.ts          Provisions `chat` singleton + N chat pairs
│   └── bot-users.teardown.ts  Parallel DELETE of everything in the pool, removes pool file
├── test-products/          Test products for security probes
└── tests/
    ├── record.e2e.ts       Standalone recorder script (Playwright Inspector)
    └── security/           Security tests (non-BDD, own fixtures)
```

## Test Projects

| Project | Tag | Fixture | Isolation | Use Case |
|---|---|---|---|---|
| `smoke` | `@smoke` | `electronApp` (test-scoped) | Fresh Electron per test | Basic app functionality |
| `auth` | `@auth` | `electronApp` (test-scoped) | Fresh Electron per test | Sign-in, logout flows |
| `authenticated` | `@authenticated` | `authenticatedApp` (test-scoped) | Fresh Electron + sign-in per test | Tests requiring active session |
| `product-sdk` | `@product-sdk` | `testProductPage` + `authenticatedApp` (test-scoped) | Fresh Electron + sign-in + webview per test | Product SDK sandbox + product-integration tests (Accounts, Signing) |
| `chat` | `@chat` | `authenticatedApp` (single-client) + `alice`/`bob` (pair, test-scoped) | Fresh Electron per test everywhere; chat-pair scenarios also get a fresh `{alice, bob}` identity pair from the pool | All chat tests: single-client contact search (`chat-p2p.feature`), two-client P2P pair (`chat-p2p-pair.feature`), CoinFlip dashboard integration (`coinflip-chat.feature`) |
| `security` | — | `securityTest` (worker-scoped) | Probe-based | Sandbox isolation tests |

Plus five infra projects that run around the signing suites:

| Project | Purpose |
|---|---|
| `setup-auth` | Provisions the `auth` singleton. Dependency of `auth`. |
| `setup-authenticated` | Provisions the `authenticated` singleton. Dependency of `authenticated`. |
| `setup-product-sdk` | Provisions the `product-sdk` singleton. Dependency of `product-sdk`. |
| `setup-chat` | Provisions the `chat` singleton + `CHAT_PAIR_POOL_SIZE` Alice/Bob pairs. Dependency of `chat`. |
| `teardown-bot-users` | DELETEs every user written to the pool (regardless of which setup wrote them) and removes the pool file. Triggered via `teardown:` on every setup project — runs once at the end. |

Execution order via `dependencies`: **setup-&lt;role&gt; → &lt;role&gt; → teardown-bot-users**. Running `--project=chat` only pays `setup-chat` cost; running `test:e2e:all` runs all setups + one teardown. `globalSetup` (`e2e/setup/global-init.ts`) wipes a stale pool file at every invocation start so merging across setups stays clean. Smoke and security are independent — no bot-user provisioning.

## Bot user pool

The pool holds two kinds of pre-attested identities:

| Kind | Shape | Consumers | Lookup |
|---|---|---|---|
| Singleton roles | `users: { auth, authenticated, product-sdk, chat }` | `botUsername` fixture in `base.ts` | `readPoolUser(project.name)` |
| Chat pairs | `chatPairs: Array<{alice, bob}>` of `CHAT_PAIR_POOL_SIZE` items (default 6) | `chatPair.ts` — test-scoped `pairAssignment` | Next unused slot via `chatPairCounter` |

Each chat-pair test consumes a **fresh slot** — Alice and Bob are distinct on-chain identities per scenario, so append-only statement-store requests never leak between scenarios or between Playwright retries. Budget: `scenarios × (1 + retries)`. Override via `CHAT_PAIR_POOL_SIZE` env.

Fallback when pool file is missing (`playwright test --ignore-project-dependencies` or after a failed setup): fixtures generate a random username + lazy-attest via `BotUserSession.ensure()` — slow, leaks on crash, useful only for debugging.

Env overrides (manual repro):
- `BOT_USERNAME` — global override for `base.ts` (any signing project)
- `BOT_USERNAME_AUTH` / `BOT_USERNAME_AUTHENTICATED` / `BOT_USERNAME_PRODUCT_SDK` / `BOT_USERNAME_CHAT` — per-role pin at setup time
- Chat-pair identities are *not* env-pinnable (different slot per scenario). Edit the pool file or drop pool-mode for manual repro.

## Recording Tests

Use the built-in recorder to capture actions in the Electron app via Playwright Inspector:

```bash
npm run test:e2e:record
```

This launches the Electron app with `PWDEBUG=1` and calls `page.pause()`, which opens **Playwright Inspector**.

1. Click the **"Record"** button in the Inspector toolbar
2. Interact with the app — clicks, typing, navigation are all recorded
3. Copy the generated code from the Inspector
4. Adapt the recorded code into BDD format: `.feature` file + step definitions + Page Object

> **Note:** Product content runs inside an Electron `<webview>`, which Playwright exposes as a separate window. After navigating to a product, use `app.windows()` or `app.waitForEvent('window')` to get the webview page for interaction. See `TestProductPage` for a working example.

## How to Write a New Test

### 1. Create or update a .feature file

```gherkin
@smoke @allure.label.parentSuite:smoke @allure.label.suite:My_Feature
Feature: My Feature

  Scenario: Something works
    Given the app is launched
    When the user does something
    Then something happens
```

- `@smoke` / `@auth` / `@authenticated` — determines which project runs it
- `@allure.label.parentSuite:` — Allure report grouping (must match project name)
- `@allure.label.suite:` — Allure sub-group name

### 2. Add step definitions

```typescript
// e2e/steps/my.steps.ts
import { createBdd } from 'playwright-bdd';
import { test, expect } from '../fixtures/base';

const { Given, When, Then } = createBdd(test);

When('the user does something', async ({ electronApp }) => {
  // Use Page Objects, not raw selectors
  const page = new MyPage(electronApp.window);
  await page.doSomething();
});
```

For authenticated tests, use `authenticatedTest` and `authenticatedApp`:

```typescript
import { createBdd } from 'playwright-bdd';
import { authenticatedTest } from '../fixtures/authenticated';

const { Given, Then } = createBdd(authenticatedTest);

Given('the user is authenticated', async ({ authenticatedApp }) => {
  await authenticatedApp.window.waitForURL(/dashboard/);
});
```

### 3. Use Page Objects

```typescript
// e2e/page-objects/MyPage.ts
import { type Page, expect } from '@playwright/test';
import { TEST_IDS } from '@/shared/test-ids';

export class MyPage {
  constructor(private readonly page: Page) {}

  get myButton() {
    return this.page.getByTestId(TEST_IDS.myButton);
  }

  async clickMyButton() {
    await expect(this.myButton).toBeVisible({ timeout: 5_000 });
    await this.myButton.locator('button').click();
  }
}
```

### 4. Add data-testid to components

All test IDs live in `src/shared/test-ids.ts` — single source of truth for both app and tests.

```typescript
// src/shared/test-ids.ts
export const TEST_IDS = {
  myButton: 'my-button',
} as const;
```

Since `HeaderButton` and some UI kit components don't forward rest props, wrap with a `<div>`:

```tsx
<div data-testid={TEST_IDS.myButton}>
  <HeaderButton variant="icon" onClick={handleClick}>
    <Icon />
  </HeaderButton>
</div>
```

### 5. Attach screenshots

```gherkin
Then the dashboard screenshot is taken as "my-screenshot"
```

Step implementation uses `$testInfo` fixture:

```typescript
Then('the dashboard screenshot is taken as {string}', async ({ electronApp, $testInfo }, name: string) => {
  const screenshot = await electronApp.window.screenshot();
  await $testInfo.attach(name, { body: screenshot, contentType: 'image/png' });
});
```

### 6. Register in playwright.config.ts

Add new `.feature` files to the appropriate `defineBddConfig()`:

```typescript
const bddSmokeDir = defineBddConfig({
  features: [
    // ... existing features
    './e2e/features/my-feature.feature',  // add here
  ],
  steps: sharedSteps,
});
```

### 7. Regenerate and run

```bash
npm run build:e2e                # Build with AUTOTEST=true, RENDERER_SOURCE=filesystem
rm -rf .features-gen && npx bddgen  # Regenerate specs from .feature files
npm run test:e2e:all             # Run all: smoke, auth, authenticated, product-sdk, chat
```

## Commands

```bash
npm run build:e2e              # Build app for e2e (AUTOTEST + filesystem renderer)
npm run test:e2e:gen           # Regenerate BDD specs from .feature files
npm run test:e2e               # Run smoke tests only
npm run test:e2e:auth          # Run auth tests only (sign-in, logout)
npm run test:e2e:authenticated # Run authenticated session tests only
npm run test:e2e:product-sdk   # Run product SDK tests (Accounts, Signing, etc.)
npm run test:e2e:chat          # Run all chat tests (contact search + two-client Alice+Bob pair)
npm run test:e2e:all           # Run all BDD tests (smoke, auth, authenticated, product-sdk, chat)
npm run test:e2e:security      # Run security probe tests
npm run test:e2e:ui            # Playwright interactive UI mode
npm run test:e2e:record        # Launch Electron with Playwright Inspector for recording
npm run test:e2e:report        # Open HTML report
```

## Key Conventions

- **Page Objects over raw selectors** — all UI interaction goes through page objects
- **`TEST_IDS` for data-testid** — shared between `src/` components and `e2e/` tests
- **`clearAppData()` before every test** — guarantees clean state on reruns
- **`workers: 1`** — Electron is heavy, parallel execution causes conflicts
- **Allure tags in .feature files** — `@allure.label.parentSuite:` and `@allure.label.suite:` control report hierarchy
- **`suiteTitle: false`** in Allure config — suite names come only from Gherkin tags, not file paths
- **`BOT_TOKEN` at build time** — signing bot auth token baked into the e2e build
- **Cucumber VS Code extension** — configured via `.vscode/settings.json` for step navigation

## Keeping Docs Up to Date

This directory has two documentation files — keep them in sync with code changes:

- **`CLAUDE.md`** — rules and patterns for AI-assisted test writing. Update when changing conventions, fixture API, or step
  patterns.
- **`README.md`** (this file) — architecture, directory structure, and developer guide. Update when changing structure, adding
  projects, or modifying execution flow.

| What changed | What to update |
|---|---|
| New test project | Both docs + `playwright.config.ts` + `package.json` |
| New fixture or fixture API change | Both docs |
| New Page Object | `README.md` (directory structure section) |
| New convention or rule | `CLAUDE.md` (Rules section) |
| New npm script | Both docs + root `CLAUDE.md` (Commands section) |
| New `data-testid` | `src/shared/test-ids.ts` only |
| Architecture change (diagram) | `README.md` (Architecture section) |
