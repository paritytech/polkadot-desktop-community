# E2E Tests

BDD-style end-to-end tests for the Polkadot Desktop Electron app using [Playwright](https://playwright.dev/) and [playwright-bdd](https://github.com/vitalets/playwright-bdd) with Gherkin syntax.

## Architecture

```
                         ┌─────────────────────────────────────────────┐
                         │             playwright.config.ts            │
                         │                                             │
                         │  defineBddConfig() x3 → .features-gen/     │
                         │  projects: smoke → auth → authenticated     │
                         │  fullyParallel, workers env-overridable     │
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
     │ Fresh Electron │     │ per test         │     │ per WORKER +     │
     │ per test       │     │ AUTOTEST=true    │     │ soft-reset/test  │
     └───────┬────────┘     └────────┬─────────┘     └────────┬─────────┘
             │                       │                         │
             ▼                       ▼                         ▼
     ┌────────────────┐     ┌──────────────────┐     ┌──────────────────┐
     │ fixtures/      │     │ fixtures/        │     │ fixtures/        │
     │ base.ts        │     │ base.ts          │     │ authenticated.ts │
     │                │     │                  │     │                  │
     │ electronApp    │     │ electronApp      │     │ authenticatedApp │
     │ (test-scoped)  │     │ (test-scoped)    │     │ (worker reuse /  │
     │                │     │                  │     │  @isolated fresh)│
     └───────┬────────┘     └────────┬─────────┘     └────────┬─────────┘
             │                       │                         │
             ▼                       ▼                         ▼
   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────────┐
   │ Electron Process │   │ Electron Process │   │ Worker Electron (1×)      │
   │ clearAppData()   │   │ clearAppData()   │   │ sign in once, then per    │
   │ Fresh storage    │   │ Fresh storage    │   │ test: resetToAuthenticated│
   │ Unique dataDir   │   │ Unique dataDir   │   │ Baseline() — wipe per-test│
   └──────────────────┘   └──────────────────┘   │ stores, keep session,     │
                                                  │ reload → /dashboard.      │
                                                  │ Crash/logout → relaunch + │
                                                  │ re-sign-in fallback.      │
                                                  └──────────────────────────┘
```

## Directory Structure

```
e2e/
├── features/               Gherkin .feature files — one folder per project; glob-registered
│   ├── smoke/                 @smoke   app-launch, onboarding, main-view, address-bar, sandbox-health
│   ├── auth/                  @auth    sign-in, session-identity, onboarding-network
│   ├── authenticated/         @authenticated — grouped by feature area (glob: authenticated/**/*.feature)
│   │   ├── dashboard/             dashboard, product-widgets
│   │   ├── settings/              settings, appearance, profile
│   │   ├── products/              product-actions, product-cache, product-settings
│   │   ├── networks/              network, custom-chains
│   │   └── session/               authenticated-session, offline-access, quickchat, tab-switching
│   ├── link-navigation/       @link-navigation   host-router/webview navigation (local HTTP fixture)
│   ├── browser/               @browser   zoom, find, history, tabs, new-tab, address-bar, … (no auth)
│   ├── chat/                  @chat — three flavours (single-client, Alice+Bob pair, seeded)
│   │   ├── contact-search.feature     Single-client contact search
│   │   ├── chat-p2p-pair.feature      Alice + Bob 2-client P2P chat
│   │   ├── chat-seeded.feature        Seeded chat rooms (display/actions, no live P2P)
│   │   └── coinflip-chat.feature      CoinFlip product widget + dashboard chat integration
│   └── product-sdk/           @product-sdk — host-playground sandbox + product integrations
│       ├── accounts.feature       Accounts API tests
│       └── signing.feature        Signing API tests
│   (security probes are TypeScript specs in e2e/tests/security/*.e2e.ts, not Gherkin)
├── steps/                  Step definitions (Given/When/Then implementations)
│   ├── app.steps.ts            App launch steps
│   ├── onboarding.steps.ts     QR code, skip onboarding
│   ├── dashboard.steps.ts      Dashboard, theme, chat, settings, screenshots
│   ├── auth.steps.ts           Sign-in, logout, localStorage checks
│   ├── authenticated.steps.ts  Shared session steps
│   ├── chat-contact-search.steps.ts  Single-client chat navigation + contact search
│   ├── chat-p2p-pair.steps.ts  Alice + Bob 2-client chat actions
│   ├── coinflip-chat.steps.ts  CoinFlip widget add + dashboard chat send (@chat project)
│   ├── offline-access.steps.ts Product actions menu + enable offline access flow
│   └── test-product-sdk.steps.ts  Product SDK shared steps (navigate, run action, confirm signing)
├── page-objects/           Page Object pattern
│   ├── OnboardingPage.ts       QR, skip, pairing deeplink (data-pairing-deeplink)
│   ├── DashboardPage.ts        Theme, chat, settings, user button, edit mode, screenshots
│   ├── ChatPage.ts             Chat widget, fullscreen, session selection, message sending, reactions
│   ├── ContactSearchPage.ts    Chat contact search (username/SS58 direct-connect, welcome, send request)
│   ├── UserPopover.ts          Username, logout
│   ├── ProductActionsPage.ts   Product actions menu (•••), offline access confirm, pin indicator
│   └── TestProductPage.ts      Product webview interaction (navigation, categories, actions, signing)
├── fixtures/               Playwright test fixtures
│   ├── base.ts                 Test-scoped Electron (fresh per test); worker-scoped truapi-host signer (per parallelIndex)
│   ├── authenticated.ts        Worker-scoped signed-in Electron reused across tests via soft-reset; @isolated → throwaway fresh app + sign-in
│   ├── chatPair.ts             Test-scoped Alice + Bob Electrons drawn from a pool of pre-attested pairs
│   ├── test-product-sdk.ts     Authenticated + TestProductPage fixture
│   └── security.ts             Security probe fixtures
├── helpers/                Utility functions
│   ├── electron.ts             Launch/close Electron, menu clicks
│   ├── dotns.ts                Per-environment dotNS TLD + `productName(label, tld)` — the only place a suffix is spelled
│   ├── seed-products.ts        Pre-launch product / recents / dashboard-layout seeding (raw IndexedDB + localStorage; reload to apply)
│   ├── reset-state.ts          Soft-reset the shared worker session to a clean authenticated /dashboard baseline (restore the post-sign-in storage snapshot + reload; relaunch+re-sign-in fallback)
│   ├── dialogs.ts              Flag-gated permission/alias dialog auto-approver (per-test toggle on the shared page)
│   ├── cleanup.ts              Clear localStorage, IndexedDB before tests (fresh-per-test projects)
│   ├── identity-backend.ts     Read-only client for the identity registry — the authority on whether a username claim landed
│   ├── chatState.ts            Reset Dexie p2p-chat DB + navigate to dashboard
│   ├── wait.ts                 Wait utilities (idle, selector, retry)
│   ├── assertions.ts           Custom Playwright assertions
│   └── webview.ts              Product injection for security tests
├── setup/                  Infra project — warms the truapi-host signer slots the invoked projects claim
│   └── signers.setup.ts       Starts `--serve` per slot so a cold one attests here, not inside a test
├── test-products/          Test products for security probes
└── tests/
    ├── record.e2e.ts       Standalone recorder script (Playwright Inspector)
    └── security/           Security tests (non-BDD, own fixtures)
```

## Test Projects

| Project           | Tag              | Fixture                                                                | Isolation                                                                                                                                                                        | Use Case                                                                                                                                                                                                               |
| ----------------- | ---------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `smoke`           | `@smoke`         | `electronApp` (test-scoped)                                            | Fresh Electron per test                                                                                                                                                          | Basic app functionality                                                                                                                                                                                                |
| `auth`            | `@auth`          | `electronApp` (test-scoped)                                            | Fresh Electron per test                                                                                                                                                          | Sign-in, logout flows                                                                                                                                                                                                  |
| `authenticated`   | `@authenticated` | `authenticatedApp` (worker reuse)                                      | One signed-in Electron per worker + soft-reset before each test (`@isolated` → throwaway fresh app + sign-in)                                                                    | Tests requiring active session                                                                                                                                                                                         |
| `product-sdk`     | `@product-sdk`   | `testProductPage` + `authenticatedApp` (worker reuse)                  | Inherits authenticated worker reuse + soft-reset; webview per test                                                                                                               | Product SDK sandbox + product-integration tests (Accounts, Signing)                                                                                                                                                    |
| `chat`            | `@chat`          | `authenticatedApp` (single-client) + `alice`/`bob` (pair, test-scoped) | Single-client scenarios reuse the worker's signed-in app; chat-pair scenarios take a `{alice, bob}` signer pair cycled from a bounded per-worker pool (`chatpair-w<slot><a\|b>`) | All chat tests: single-client contact search (`contact-search.feature`), two-client P2P pair (`chat-p2p-pair.feature`), seeded rooms (`chat-seeded.feature`), CoinFlip dashboard integration (`coinflip-chat.feature`) |
| `security`        | —                | `securityTest` (worker-scoped)                                         | Probe-based                                                                                                                                                                      | Sandbox isolation tests                                                                                                                                                                                                |
| `link-navigation` | `@smoke`         | `electronApp` + `linkTestsTarget` (worker-scoped local HTTP)           | Fresh Electron per test                                                                                                                                                          | Host-router ↔ in-product navigation sync (no auth/chain)                                                                                                                                                               |
| `browser`         | `@browser`       | `electronApp` + `linkTestsTarget` (worker-scoped local HTTP)           | Fresh Electron per test                                                                                                                                                          | Browser-chrome features (zoom, find, history, tabs) against TestOps plan 900 — link-tests product, no auth/chain                                                                                                       |

Plus one infra project that every signer-backed suite depends on:

| Project         | Purpose                                                                                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup-signers` | Provisions any `truapi-host` slot the invoked projects need that the cached tree does not already hold. Dependency of auth / authenticated / product-sdk / chat. |

Execution order via `dependencies`: **setup-signers → (auth | authenticated | product-sdk | chat)**. On a warm
`.truapi-host/` tree it is a no-op taking seconds; on a cold one it pays one on-chain attestation per slot, which
is the cost it exists to keep out of a test's timeout. `E2E_SIGNER_PROJECTS` (set by the per-project npm scripts)
scopes it to the projects actually invoked. Smoke, security, link-navigation and browser are independent — they
never sign in.

## Product names and the network TLD

The dotNS suffix is per deployment ([paritytech/dotns#201](https://github.com/paritytech/dotns/issues/201)): the app reads it
from `DotnsProtocolRegistry.tld()` at runtime, so `host-playground` is `host-playground.paseo` on Paseo Next V2 and a
different name elsewhere. Tests therefore never spell a suffix — a `.feature` file names the **label** and the step
completes it with `productName(label, tld)` from `e2e/helpers/dotns.ts`.

The same applies to the served `link-tests` fixture: its cross-product `polkadot://` href is written as
`polkadot://cross-product-target{{TLD}}/home` and `startStaticServer` substitutes the suffix when it serves `index.html`.

That helper owns the whole mapping: `nightly` → `.paseo`, `unstable` → the app's fallback. The no-auth projects
(`browser`, `link-navigation`) _skip_ the onboarding picker rather than opting out of an environment, so its default stays
selected and the app resolves that network's TLD there too — they seed through `DEFAULT_ENVIRONMENT_ID`. When a deployment's TLD changes, this map is the only
edit; `E2E_DOTNS_TLD=.paseo` overrides it for a single run (validated against the same shape the app accepts off-chain, and
it does not move the fallback).

## Signer identities

Sign-in is driven by a local `truapi-host` process, one per worker slot. There is no service, no token, and
nothing to configure beyond the binary.

**The seam.** Under AUTOTEST the onboarding screen publishes its pairing deeplink as a `data-pairing-deeplink`
attribute on the QR container (`src/features/onboarding/ui/OnboardingScreen.tsx`); outside autotest the attribute
is absent entirely. `OnboardingPage.pairingDeeplink()` waits for it, and `SigningHost.pair()`
(`e2e/helpers/signing-host.ts`) spawns `truapi-host signing-host --serve --deeplink <it>`, which answers the
pairing and then stays up to sign for the rest of the test.

**Identity is a directory, not a name.** Each slot is its own `--base-path` under `.truapi-host/`:

| Slot                          | Claimed by                                                        |
| ----------------------------- | ----------------------------------------------------------------- |
| `<project>-w<parallelIndex>/` | the worker-scoped `signingHost` fixture in `e2e/fixtures/base.ts` |
| `chatpair-w<slot><a\|b>/`     | the two-client chat pair in `e2e/fixtures/chatPair.ts`            |

`--session` never selects an identity. It is passed only when the slot holds none yet (`slotHasIdentity` — a
`<name>_signing_host/accounts.json` other than `default`, the CLI's own rule), to name the new identity's base. On a
provisioned slot it is omitted and the CLI restores the session on disk; a base no local session matches would make
it create another identity every run. A directory is a thing this harness owns outright. The `chatpair` namespace is separate because `e2e/fixtures/authenticated.ts` also runs under the `chat`
project and already claims `chat-w<index>`.

**The tree is a secret.** Every slot directory holds a plaintext 0600 mnemonic for an attested on-chain identity.
`.truapi-host/` is gitignored, and in CI it is cached only on trusted (non-fork) runs.

**A tree with no identity is never saved.** The cache key carries `github.run_id` and the restore falls back
through `restore-keys` to the **newest** matching entry, so a run that provisioned nothing — cancelled early, or
dead before the first slot warmed — would otherwise write an empty entry that shadows the last good one, and every
run after it re-mints the whole tree. `.github/actions/run-e2e-tests/action.yml` gates the save on at least one
provisioned session (`accounts.json`, the marker `slotHasIdentity` reads) existing under `.truapi-host`, and warns
in the job summary when it skips.

**Warming.** `setup-signers` starts `--serve` against each slot and stops once the host reports ready — starting
the host is the only thing that provisions, so a warm-up built on `exec '/session'` would report success and warm
nothing. On a warm tree a slot restores in seconds. `E2E_PROVISION_CONCURRENCY` (default 4) bounds how many cold
slots attest at once. **Warming is best-effort — a slot that fails to warm never fails the setup.** A single
chain-side attestation failure would otherwise block every test in the project; instead each failure is logged
and annotated, and that slot provisions inside the first test that claims it (which may exceed that test's
timeout).

**A username base is spent, not shared.** `--session` on a fresh slot takes a _base_ (truapi-host 0.25 removed
`--lite-username-prefix`, and with no `--session` a fresh slot provisions under the CLI's shared `headless` base), and a base is a finite
chain-level pool rather than a namespace: the identity backend answers `EXHAUSTED` once its 99 discriminators
(`<base>.01`…`.99`) are owned, and equally once the bare name is owned or its reservation queue (capacity 10) is
full. `truapi-host` turns any answer but `AVAILABLE` into `lite username "<base>" is taken` and refuses to
provision — so an exhausted base does not degrade, it stops every identity the suite has yet to mint. One fixed
base for the whole suite reached that state on 2026-09-17 and failed all four signer-backed projects at once.
`freshLiteUsernameBase()` therefore mints `truapitest` + 10 random letters per invocation, so no two identities
ever draw on one pool; the stem keeps the harness's registrations recognisable.

**Never interrupt a cold start.** The username registration is POSTed within the first seconds of startup and
nothing local records that it happened, so any kill mid-provision leaves an attested identity on chain that the
tree cannot address, and spends one of the identity's daily allowance slots, with no trace and no error.
`READY_TIMEOUT_MS` in `signing-host.ts` is generous for this reason and must not be tightened.

**Teardown clears the slot's paired devices**, and that is not tidiness: `truapi-host` refuses to rotate an
identity while any paired device still depends on it, so a pairing left behind blocks recovery the next time that
identity's daily allowance-slot budget (`Resources.LiteStmtStoreSlotsPerPeriod = 10`/identity/day) runs out. The
process must be stopped before the pairings are cleared.

**Reset, not heal.** A sign-in wedged in pairing (`StuckPairingError` — a chain redeploy that wiped personhood) or
rejected with the "Limit Reached" no-free-slots error (`PairingLimitError` — an exhausted daily budget, detected
fast from the onboarding error panel instead of burning the full navigation timeout) cannot be fixed by retrying
against the same signer state. `signInWithReset` (`e2e/helpers/sign-in.ts`) stops the host, clears its pairings,
and retries. There is no permanent-vs-random distinction any more — every slot is a durable identity.

**Confirming a claim.** `e2e/helpers/identity-backend.ts` asks the identity registry whether a username claim
landed. The registry owns the registration and is what the app's contact search reads, so waiting for it waits for
exactly what the tests then assert, and it supplies the backend-assigned lite username (`truapitest….23`) for UI
assertions. `findRegistrations` distinguishes two answers that must never be conflated: `null` means **could not
tell** (no `E2E_IDENTITY_URL`, request failed, or a 402 proof-of-compute demand), and `[]` means **definitively
not registered**. A registry that cannot answer is never evidence a claim failed.

Which registry to ask is deployment configuration and lives nowhere in this repository: set `E2E_IDENTITY_URL` to
the registry **for the network under test**. Unset, the run still passes — the harness falls back to the username
`truapi-host` prints on its own startup line, which already carries the backend-assigned suffix — and says so once
in the log. Pointed at another chain's registry it answers fine and reports every claim as missing, so treat it as
infrastructure config, not a toggle.

Env overrides (manual repro):

- `TRUAPI_HOST_BIN` — path to the binary (default: whatever `truapi-host` resolves to on PATH). Point it at a
  local build to test an unreleased CLI fix.
- `TRUAPI_HOST_BASE_PATH` — root holding the slot directories (default `./.truapi-host`)
- `E2E_SIGNER_PROJECTS` — comma-separated projects whose slots `setup-signers` warms. Set by the per-project npm
  scripts; it MUST sit on the `playwright` command, not at the head of the script, since `VAR=v a && b` scopes
  `VAR` to `a` alone.
- `E2E_WORKERS` / `--workers` — worker count (default `CI ? 4 : '50%'`). `setup-signers` reads it too, so a local
  run wanting warmed identities should set it explicitly.
- `E2E_PROVISION_CONCURRENCY` — how many cold slots attest at once (default 4)
- `E2E_IDENTITY_URL` — the identity registry that confirms claims (unset → not confirmed)

The last two are also wired through CI: set the repository (or organization) variables
`E2E_PROVISION_CONCURRENCY` / `E2E_IDENTITY_URL` and the workflow forwards them to the run. An unset variable
arrives as an empty value, which the harness reads as "not configured".

**CI.** The composite action installs `truapi-host` and restores/saves `.truapi-host` only when the calling job
opts in (`signer-backed` / `identity-cache`, both default `false`) — the same action also runs the `security` job
and the macOS/Windows `smoke` rows, and the CLI publishes no Windows or Intel-Mac binary. The identity cache is
keyed per project **and** per run: entries are immutable, so a fixed key would never pick up identities attested
after the first save, and `github.run_id` alone collides across matrix shards. A partial cache restore is the
dangerous case — a slot that lost its account store provisions a fresh identity — so `setup-signers` logs every
slot that lacks a restorable identity.

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
    await this.myButton.click();
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

The local controls in `@/shared/components` (`Button`, `IconButton`, `SegmentedControl.Item` through `testId`) put the test id on the control itself:

```tsx
<IconButton data-testid={TEST_IDS.myButton} label="My action" onClick={handleClick}>
  <Icon />
</IconButton>
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

Each `defineBddConfig()` registers its project's feature folder with a **glob**, so a new `.feature` is auto-detected
once placed in the matching folder — no config change for new feature files:

```typescript
const bddSmokeDir = defineBddConfig({
  features: ['./e2e/features/smoke/*.feature'],
  steps: sharedSteps,
});
const bddAuthenticatedDir = defineBddConfig({
  features: ['./e2e/features/authenticated/**/*.feature'], // recursive — nested by feature area
  steps: [/* ... */],
});
```

Only edit `playwright.config.ts` when adding a **new project** (new folder + `defineBddConfig` + a `projects` entry)
or when a feature needs a new step file added to the project's `steps:` array.

### 7. Regenerate and run

```bash
npm run build:e2e                # Build with AUTOTEST=true, RENDERER_SOURCE=filesystem
rm -rf .features-gen && npx bddgen  # Regenerate specs from .feature files
npm run test:e2e:all             # Run all: smoke, auth, authenticated, product-sdk, chat, link-navigation, browser
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
npm run test:e2e:all           # Run all BDD tests (smoke, auth, authenticated, product-sdk, chat, link-navigation, browser)
npm run test:e2e:link-navigation # Host-router navigation tests (local HTTP fixture, no auth)
npm run test:e2e:browser       # Browser-chrome tests (zoom, find, … — link-tests product, no auth)
npm run test:e2e:security      # Run security probe tests
npm run test:e2e:ui            # Playwright interactive UI mode
npm run test:e2e:record        # Launch Electron with Playwright Inspector for recording
npm run test:e2e:report        # Open HTML report
```

## Key Conventions

- **Page Objects over raw selectors** — all UI interaction goes through page objects
- **`TEST_IDS` for data-testid** — shared between `src/` components and `e2e/` tests
- **`clearAppData()` before every test** — fresh-per-test projects (smoke/auth/`@isolated`); the `authenticated` worker session uses the soft-reset (`reset-state.ts`) instead
- **`fullyParallel`, `workers` env-overridable** — `authenticated` reuses one signed-in Electron per worker (soft-reset between tests); each worker claims its own signer slot by `parallelIndex` (see "Signer identities"), so parallel workers don't collide on chain. `auth`/`smoke` stay fresh-per-test
- **Allure tags in .feature files** — `@allure.label.parentSuite:` and `@allure.label.suite:` control report hierarchy
- **`suiteTitle: false`** in Allure config — suite names come only from Gherkin tags, not file paths
- **Cucumber VS Code extension** — configured via `.vscode/settings.json` for step navigation

## Keeping Docs Up to Date

This directory has two documentation files — keep them in sync with code changes:

- **`CLAUDE.md`** — rules and patterns for AI-assisted test writing. Update when changing conventions, fixture API, or step
  patterns.
- **`README.md`** (this file) — architecture, directory structure, and developer guide. Update when changing structure, adding
  projects, or modifying execution flow.

| What changed                      | What to update                                      |
| --------------------------------- | --------------------------------------------------- |
| New test project                  | Both docs + `playwright.config.ts` + `package.json` |
| New fixture or fixture API change | Both docs                                           |
| New Page Object                   | `README.md` (directory structure section)           |
| New convention or rule            | `CLAUDE.md` (Rules section)                         |
| New npm script                    | Both docs + root `CLAUDE.md` (Commands section)     |
| New `data-testid`                 | `src/shared/test-ids.ts` only                       |
| Architecture change (diagram)     | `README.md` (Architecture section)                  |
