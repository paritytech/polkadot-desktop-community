# E2E Tests

BDD-style Electron tests using `playwright-bdd` with Gherkin `.feature` files. See [README.md](README.md) for full architecture
diagram and setup guide.

## Structure

`e2e/features/` (Gherkin scenarios) → `e2e/steps/` (step definitions) → `e2e/page-objects/` (Page Objects)

## Test Projects

Projects: `smoke → auth → authenticated`, plus `product-sdk`, `chat`, `security`, and `link-navigation` (independent)

- `smoke` — basic app launch, onboarding, dashboard (fresh Electron per test)
- `auth` — sign-in and logout flows via signing bot (fresh Electron per test, `AUTOTEST=true`)
- `authenticated` — tests requiring a signed-in session (fresh Electron per test, signs in via signing bot)
- `product-sdk` — product sandbox API tests via host-playground (Accounts, Signing). Feature files in `e2e/features/product-sdk/`, shared steps in `e2e/steps/test-product-sdk.steps.ts` (all steps bind to `test` from `e2e/fixtures/test-product-sdk.ts` — which extends `authenticatedTest`).
- `chat` — all chat features grouped in one project under `e2e/features/chat/`. Mixed fixtures because chat has three flavours of test:
  - `chat-p2p.feature` — single-client contact search against a signing-bot peer identity. Uses `authenticatedTest` via `chat-p2p.steps.ts`.
  - `chat-p2p-pair.feature` — two Electron clients (Alice + Bob) with random per-worker bot identities (generated inline, overridable via `BOT_USERNAME_ALICE` / `BOT_USERNAME_BOB`), signing in once per worker. Uses `chatPairTest` via `chat-p2p-pair.steps.ts`, fixture `e2e/fixtures/chatPair.ts`. Timeout 600s — two sign-ins + on-chain chat handshake.
  - `coinflip-chat.feature` — single Electron, adds CoinFlip product widget to the dashboard and sends a chat message via the QuickChat popover. Uses `authenticatedTest` via `coinflip-chat.steps.ts`.
- `security` — sandbox isolation probes (independent, own fixtures)
- `link-navigation` — host-router/webview navigation behavior. Uses a local HTTP fixture (`e2e/test-products/link-tests/`) served on an ephemeral port; tests open `localhost:<port>` via the address bar so no DotNS/IPFS/chain is required. No auth.

## Writing Tests

### 1. Feature file

```gherkin
@smoke @allure.label.parentSuite:smoke @allure.label.suite:Feature_Name
Feature: My Feature

  Scenario: Something works
    Given the app is launched
    When the user does something
    Then something happens
```

- First tag (`@smoke` / `@auth` / `@authenticated`) determines which project runs it
- `@allure.label.parentSuite:` — must match project name (lowercase)
- `@allure.label.suite:` — Allure sub-group (underscores instead of spaces)

### 2. Step definitions

```typescript
// e2e/steps/my.steps.ts
import { createBdd } from 'playwright-bdd';
import { test, expect } from '../fixtures/base';
import { MyPage } from '../page-objects/MyPage';

const { Given, When, Then } = createBdd(test);

When('the user does something', async ({ electronApp }) => {
  const page = new MyPage(electronApp.window);
  await page.doSomething();
});
```

For authenticated tests use `authenticatedTest` and `authenticatedApp`:

```typescript
import { createBdd } from 'playwright-bdd';
import { authenticatedTest } from '../fixtures/authenticated';

const { Given, Then } = createBdd(authenticatedTest);

Given('the user is authenticated', async ({ authenticatedApp }) => {
  await authenticatedApp.window.waitForURL(/dashboard/);
});
```

### 3. Page Objects

```typescript
// e2e/page-objects/MyPage.ts
import { type Page, expect } from '@playwright/test';
import { TEST_IDS } from '@/shared/test-ids';
import { DEFAULT_TIMEOUT } from '../helpers/timeouts';

export class MyPage {
  constructor(private readonly page: Page) {}

  get myButton() {
    return this.page.getByTestId(TEST_IDS.myButton);
  }

  async clickMyButton() {
    await expect(this.myButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    // HeaderButton doesn't forward rest props, so testid is on a wrapper div
    await this.myButton.locator('button').click();
  }
}
```

**Timeouts.** Never hardcode `timeout: <number>` in tests or page objects. Use one of three constants from `e2e/helpers/timeouts.ts`:

- `DEFAULT_TIMEOUT` (30s) — UI element waits, navigation, page loads
- `LONG_TIMEOUT` (60s) — heavy operations like webview/product loading
- `VERY_LONG_TIMEOUT` (90s) — sign-in flows that involve handshake + on-chain attestation

### 4. data-testid

All test IDs live in `src/shared/test-ids.ts` — single source of truth for both app components and tests.

```typescript
// src/shared/test-ids.ts
export const TEST_IDS = {
  myButton: 'my-button',
} as const;
```

`HeaderButton` and some `@novasamatech/tr-ui` components don't forward rest props. Wrap with a `<div>`:

```tsx
import { TEST_IDS } from '@/shared/test-ids';

<div data-testid={TEST_IDS.myButton}>
  <HeaderButton variant="icon" onClick={handleClick}>
    <Icon />
  </HeaderButton>
</div>
```

### 5. Screenshots

```gherkin
Then the dashboard screenshot is taken as "my-screenshot"
```

Use `$testInfo` fixture (not the third callback argument):

```typescript
Then('the dashboard screenshot is taken as {string}', async ({ electronApp, $testInfo }, name: string) => {
  const screenshot = await electronApp.window.screenshot();
  await $testInfo.attach(name, { body: screenshot, contentType: 'image/png' });
});
```

### 6. Auto-approved permission dialogs

By default, every test auto-approves product permission/alias request dialogs
(`permissionDialogAllowAlways`, `aliasPermissionAllow`) via a renderer-side
MutationObserver installed in `e2e/helpers/dialogs.ts`. Tests don't have to know
which products may pop dialogs.

**Opt out** when the test itself needs to assert on the dialog (e.g. permission
UX tests): add the `@manual-permissions` tag to the feature.

```gherkin
@authenticated @manual-permissions @allure.label.parentSuite:authenticated @allure.label.suite:Permissions
Feature: Permission dialog UX
  ...
```

### 7. Register in config

Add new `.feature` files to the appropriate `defineBddConfig()` in `playwright.config.ts`:

```typescript
const bddSmokeDir = defineBddConfig({
  features: [
    // ... existing
    './e2e/features/my-feature.feature',
  ],
  steps: sharedSteps,
});
```

## Rules

- **Page Objects over raw selectors** — all UI interaction goes through page objects
- **`TEST_IDS` for data-testid** — shared between `src/` components and `e2e/` tests, never hardcode strings
- **`clearAppData()` before every test** — fixtures handle this, guarantees clean state on reruns
- **`workers: 1`** — Electron is heavy, parallel execution causes conflicts
- **Allure tags in .feature files** — control report hierarchy, not file paths
- **`@manual-permissions` tag** — opts out of the renderer-side permission/alias dialog auto-approver (see writing-tests section 6). Use only when the test asserts on the dialog itself
- **`suiteTitle: false`** in Allure config — suite names come only from Gherkin tags
- **`BOT_TOKEN` at build time** — signing bot auth token baked into the e2e build via `npm run build:e2e`
- **Bot users are provisioned per-project upfront** — each test project that signs in declares a dedicated setup project as its `dependencies`, so running `--project=auth` does NOT attest a chat user, running `--project=chat` does NOT attest an `authenticated` user, etc. Setup projects:
  - `setup-auth` → one `auth` singleton
  - `setup-authenticated` → one `authenticated` singleton
  - `setup-product-sdk` → one `product-sdk` singleton
  - `setup-chat` → one `chat` singleton + `CHAT_PAIR_POOL_SIZE` (default 6 = 2 scenarios × 3 attempts including CI retries) pre-attested `{alice, bob}` pairs
- All singletons land in `pool.users` keyed by role; chat pairs land in `pool.chatPairs`. Setup projects merge into the pool file rather than overwriting, so multiple selected setups accumulate. `globalSetup` (`e2e/setup/global-init.ts`) wipes a stale pool at invocation start to keep merging clean. Singletons are pinnable via `BOT_USERNAME_<ROLE>` env (e.g. `BOT_USERNAME_AUTH`) or `BOT_USERNAME` for any-project override. Chat-pair identities are *not* env-pinnable — each chat-pair test consumes the next slot via a worker-scoped counter (`pairAssignment` fixture in `chatPair.ts`), so on-chain statement-store state never bleeds between scenarios or retries.
- `teardown-bot-users` DELETEs every singleton and every pair-member in parallel once dependents finish. Auth steps must use `"the user pairs via signing bot on {environmentId}"` / `"the user is signed in on {environmentId} via signing bot"` (where `{environmentId}` is a `VITE_ENVIRONMENTS` channel key — currently `nightly` or `unstable`; see `e2e/helpers/environment.ts`) — **never hardcode usernames in `.feature` files**.
- **Failure artifacts** — all projects use the test-scoped `electronApp` fixture from `base.ts`. On failure it attaches `screenshot` (PNG) to the Allure result (best-effort — lost if the window is already dead). On retry (`testInfo.retry > 0`) Electron is launched with `recordVideo` and the `.webm` is attached unconditionally. `authenticated` and `product-sdk` compose `authenticatedApp` on top of `electronApp` and inherit both behaviours for free.
- **Cucumber VS Code extension** — configured via `.vscode/settings.json` for step navigation

## Commands

```bash
npm run build:e2e              # Build app for e2e (AUTOTEST + filesystem renderer)
npm run test:e2e:gen           # Regenerate BDD specs from .feature files
npm run test:e2e               # Smoke tests
npm run test:e2e:auth          # Auth flow tests (sign-in, logout)
npm run test:e2e:authenticated # Authenticated session tests
npm run test:e2e:chat          # All chat tests (single-client contact search + two-client Alice+Bob pair)
npm run test:e2e:all           # All BDD tests (smoke → auth → authenticated → product-sdk → chat)
npm run test:e2e:security      # Security probe tests
npm run test:e2e:link-navigation  # Host-router navigation tests (local HTTP fixture, no auth)
npm run test:e2e:ui            # Playwright interactive UI mode
npm run test:e2e:report        # Open HTML report
```

## Keeping Docs Up to Date

When making changes to E2E tests, update these docs:

- **This file (`e2e/CLAUDE.md`)** — update when changing rules, conventions, fixture API, step patterns, or adding new test
  projects. This file is the source of truth for AI-assisted test writing.
- **`e2e/README.md`** — update when changing architecture, directory structure, adding new projects, or modifying the execution
  flow diagram. This file is the source of truth for developers.
- **`src/shared/test-ids.ts`** — add new IDs here when adding `data-testid` to components. Never hardcode test ID strings.
- **`playwright.config.ts`** — register new `.feature` files in the appropriate `defineBddConfig()`.

Changes that require doc updates:

| Change | Update |
|---|---|
| New test project (e.g. `performance`) | Both docs + `playwright.config.ts` + `package.json` scripts |
| New fixture (e.g. worker-scoped) | Both docs (fixture API section) |
| New Page Object | `e2e/README.md` (directory structure) |
| New convention or rule | `e2e/CLAUDE.md` (Rules section) |
| New npm script | Both docs (Commands section) + `CLAUDE.md` (Commands section) |
| New `data-testid` | `src/shared/test-ids.ts` only (docs describe the pattern, not individual IDs) |
