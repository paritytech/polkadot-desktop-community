# E2E Tests

BDD-style Electron tests using `playwright-bdd` with Gherkin `.feature` files. See [README.md](README.md) for full architecture
diagram and setup guide.

## Structure

`e2e/features/` (Gherkin scenarios) → `e2e/steps/` (step definitions) → `e2e/page-objects/` (Page Objects)

**Feature files are classified into one folder per Playwright project, and the `authenticated` project is further
grouped by feature area.** Each project's `defineBddConfig()` registers its folder with a glob, so a new `.feature`
is picked up by dropping it in the right folder — no config edit needed (except for a brand-new project).

```
e2e/features/
├── smoke/            app-launch, onboarding, main-view, address-bar, sandbox-health
├── auth/             sign-in, session-identity, onboarding-network
├── authenticated/    grouped by area (glob: authenticated/**/*.feature)
│   ├── dashboard/    dashboard, product-widgets
│   ├── settings/     settings, appearance, profile
│   ├── products/     product-actions, product-cache, product-settings
│   ├── networks/     network, custom-chains
│   └── session/      authenticated-session, offline-access, quickchat, tab-switching
├── link-navigation/  link-navigation
├── browser/          zoom, find, history, tab-bar, tabs-shortcuts, new-tab, address-bar, appearance, onboarding, external-links
├── chat/             chat-p2p-pair, chat-seeded, contact-search, chat-list, chat-add-to-dashboard, coinflip-chat
└── product-sdk/      accounts, signing, sign-payload, host-api, permissions, permission-settings, permission-theming, alias-permissions, allowances
```

Security probes are TypeScript Playwright specs (`e2e/tests/security/*.e2e.ts`), not Gherkin. The folder a file
lives in does not determine which project runs it — the **first tag** (`@smoke`/`@auth`/`@authenticated`/…) does —
but folder and project are kept aligned for clarity.

## Test Projects

Projects: `smoke → auth → authenticated`, plus `product-sdk`, `chat`, `security`, `link-navigation`, and `browser` (independent)

- `smoke` — basic app launch, onboarding, dashboard (fresh Electron per test)
- `auth` — sign-in and logout flows through the worker's `truapi-host` signer (fresh Electron per test, `AUTOTEST=true`)
- `authenticated` — tests requiring a signed-in session. **One Electron is signed in once per worker and reused across all its tests**; between tests a soft-reset (`helpers/reset-state.ts`) wipes per-test state, preserves the session keys, reloads, and lands back authenticated on `/dashboard` — no re-pairing. Runs `fullyParallel`; each worker claims its own signer slot by `parallelIndex` (see "Signer identities" in Rules). Tests that end/mutate the session opt out with `@isolated` (throwaway fresh app + own sign-in).
- `product-sdk` — product sandbox API tests via host-playground (Accounts, Signing). Feature files in `e2e/features/product-sdk/`, shared steps in `e2e/steps/test-product-sdk.steps.ts` (all steps bind to `test` from `e2e/fixtures/test-product-sdk.ts` — which extends `authenticatedTest`).
- `chat` — all chat features grouped in one project under `e2e/features/chat/`. Mixed fixtures because chat has three flavours of test:
  - `contact-search.feature` / `chat-list.feature` — single-client chat navigation and contact search. Use `authenticatedTest` via `chat-contact-search.steps.ts`.
  - `chat-p2p-pair.feature` — two Electron clients (Alice + Bob), each driven by its own `truapi-host` signer. The pair is cycled from a bounded per-worker pool of `chatpair-w<slot><a|b>` base-path slots (`CHATPAIR_POOL_SIZE` in `e2e/fixtures/chatPair.ts`), so adjacent scenarios never share an identity while the identity count stays fixed for the cache. Uses `chatPairTest` via `chat-p2p-pair.steps.ts`. Timeout 600s — two sign-ins + on-chain chat handshake.
  - `coinflip-chat.feature` — single Electron, adds CoinFlip product widget to the dashboard and sends a chat message via the QuickChat popover. Uses `authenticatedTest` via `coinflip-chat.steps.ts`.
- `security` — sandbox isolation probes (independent, own fixtures)
- `link-navigation` — host-router/webview navigation behavior. Uses a local HTTP fixture (`e2e/test-products/link-tests/`) served on an ephemeral port; tests open `localhost:<port>` via the address bar so no DotNS/IPFS/chain is required. No auth.
- `browser` — browser-chrome features (zoom, find-in-page, history, tabs, …) automated against TestOps plan 900. Reuses the same `link-tests` local product as a real product webview (so product-route guards are active) — no auth, no chain. Menu-driven features are triggered via `clickMenuItem` (`e2e/helpers/electron.ts`), which invokes the menu item's handler and sends the same IPC the accelerator would. Feature files in `e2e/features/browser/`.

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

### Linking a scenario to its TestOps case (`@allure.id`)

Scenarios that automate a case from Regression test plan 900 on the project's Allure TestOps instance link
to it so TestOps shows coverage. The case map + current automation status live in
[docs/regression-testplan-900-cases.md](docs/regression-testplan-900-cases.md). The mechanism:

1. **Scenario name** starts with the `TC-x.y.z` id, then the case title.
2. **`@allure.id:<numericCaseId>`** tag on the scenario — the machine link. The numeric id (the `allureCaseId`)
   is in [docs/regression-testplan-900-cases.md](docs/regression-testplan-900-cases.md); it is NOT the `TC-x.y.z`
   string. allure-playwright forwards this tag and matches the result to the case on upload.

```gherkin
@authenticated @allure.id:14901 @allure.label.parentSuite:authenticated @allure.label.suite:Appearance @allure.label.feature:Theme
Feature: Appearance settings

  @allure.id:14901
  Scenario: TC-10.2.2 Switch to dark theme via user popover
    ...
```

- **One `@allure.id` per scenario** (Allure allows a single id per test). When a scenario covers two adjacent
  cases, link the primary id and note the secondary in a comment.
- A scenario that is extra coverage with no matching TestOps case stays **untagged** (add a comment saying so).
- Feature-level `@allure.id` is allowed when a single-scenario feature maps 1:1 to a case, but prefer the
  scenario level so multi-scenario features stay unambiguous.

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
    // A tr-ui component doesn't forward rest props, so testid is on a wrapper div
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

Some `@novasamatech/tr-ui` components don't forward rest props. Wrap those with a `<div>`. The local `Button` and `IconButton` (`@/shared/components`) take `data-testid` directly:

```tsx
import { TEST_IDS } from '@/shared/test-ids';

<IconButton data-testid={TEST_IDS.myButton} label="My action" onClick={handleClick}>
  <Icon />
</IconButton>;
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
(`permissionDialogAllowAlways`, `aliasPermissionAllow`)
via a renderer-side MutationObserver installed in `e2e/helpers/dialogs.ts`. Tests
don't have to know which products may pop dialogs.

**Opt out** when the test itself needs to assert on the dialog (e.g. permission
UX tests): add the `@manual-permissions` tag to the feature.

**Two prompts are answered regardless of the tag** — the core's product-subtree
review (`productSubtreeAllow`, "Allow this app to access its account?"), raised
ahead of the request a scenario actually drives, and the account-access review
(`accountAccessAllow`). No scenario is about either, and leaving one up puts a
modal overlay in front of every signing / alias / permission case. Opting out
means "let me drive the dialog under test", not "let me answer the core's
preamble everywhere".

The core's device/remote prompt and the host's own remote-URL grant render the same
`RemotePermissionRequestDialog`, and both offer all three answers — Deny, Allow
Once, Allow Always.

```gherkin
@authenticated @manual-permissions @allure.label.parentSuite:authenticated @allure.label.suite:Permissions
Feature: Permission dialog UX
  ...
```

On the **shared worker-scoped authenticated page** the auto-approver can't be a
one-shot per-launch install (the page is reused). Instead the MutationObserver
is installed once at worker launch and gated by a localStorage flag
(`__e2e_dialog_auto_approve`) read live on every dialog; the per-test soft-reset
flips it via `setDialogAutoApprove` — enabled for normal tests, disabled for
`@manual-permissions` — so no dialog state bleeds across tests on the shared
page. The flag is on the reset preserve-list so it survives the
reload-with-fresh-observer.

### 6a. `@isolated` — opt out of the shared worker session

By default an `@authenticated` scenario reuses the worker's shared signed-in app
(soft-reset to a clean `/dashboard` baseline before the test). A scenario that
**ends or mutates the session** (logs out, switches network and confirms) or
needs a genuine cold start must tag itself `@isolated` — it then gets a
throwaway fresh Electron with its own sign-in (today's per-test behavior),
leaving the worker app untouched. A logout left un-tagged would log the shared
worker app out and the next test's reset would have to fall back to a full
re-sign-in; `@isolated` makes it correct by construction.

```gherkin
  @isolated @allure.id:14907
  Scenario: TC-10.3.4 Log out from the user popover ends the session
    ...
```

Currently tagged `@isolated`: the two logout scenarios in
`authenticated/settings/profile.feature` (TC-10.3.4, TC-2.3.2).

### 7. Register in config

Each project's `defineBddConfig()` in `playwright.config.ts` registers its feature folder with a **glob**, so a new
`.feature` is picked up automatically once you drop it in the matching folder — no config edit needed:

```typescript
const bddSmokeDir = defineBddConfig({
  features: ['./e2e/features/smoke/*.feature'], // smoke/, auth/, link-navigation/, browser/, chat/, product-sdk/
  steps: sharedSteps,
});
const bddAuthenticatedDir = defineBddConfig({
  features: ['./e2e/features/authenticated/**/*.feature'], // recursive — nested by feature area
  steps: [/* ... */],
});
```

Put the file in the folder for its project (and, under `authenticated/`, the sub-folder for its feature area —
`dashboard/`, `settings/`, `products/`, `networks/`, `session/`). You only touch `playwright.config.ts` when adding a
**new project** or a **new `authenticated/` area** (and even then the glob usually already covers it). If a feature
also needs a new step file, add that to the project's `steps:` array.

### 7a. Product names are labels, not full names (`helpers/dotns.ts`)

Since [paritytech/dotns#201](https://github.com/paritytech/dotns/issues/201) the dotNS suffix is **per deployment** — read
from `DotnsProtocolRegistry.tld()` — so one product is a different name on different environments. A `.feature` file
therefore names a product by its **label** and the step completes it:

```gherkin
    And the test product "host-playground" is opened
    Given the user opens "coinflipgame03" in a new tab
```

```typescript
import { AUTH_TLD } from '../fixtures/authenticated';
import { productName } from '../helpers/dotns';

Given('the test product {string} is opened', async ({ testProductPage }, label: string) => {
  await testProductPage.navigateTo(productName(label, AUTH_TLD));
});
```

- **`e2e/helpers/dotns.ts` is the only place a suffix is spelled.** It maps each `E2eEnvironmentId` to its TLD
  (`nightly` → `.paseo`, `unstable` → the fallback) and exports `productName(label, tld)` plus `DEFAULT_ENVIRONMENT_ID`
  for the projects that never pick one.
- **`E2E_DOTNS_TLD` overrides the map for a run** (`E2E_DOTNS_TLD=.paseo npm run test:e2e:product-sdk`) — for when a
  deployment changes its TLD before the map catches up. It is validated against the same shape the app accepts off-chain
  (`^\.[a-z0-9][a-z0-9-]{0,62}$`), so a typo fails at load rather than as a pile of unresolvable products. It does **not**
  move `FALLBACK_TLD`, which mirrors the app's own constant and is what the no-auth projects derive with.
- **Signed-in projects** (`authenticated`, `product-sdk`, `chat`) use `AUTH_TLD` from `fixtures/authenticated.ts` — the
  suffix of the environment they sign in on.
- **No-auth projects** (`browser`, `link-navigation`) still run on an environment: they _skip_ the onboarding picker rather
  than opting out, so its default stays selected and the app resolves that network's TLD like anywhere else (verified — the
  browser project's address bar reads "Enter .paseo address" with nothing signed in). Seed with
  `networkTld(DEFAULT_ENVIRONMENT_ID)`, not the fallback, or the pinned grid looks for ids nothing seeded.
- **The `link-tests` HTML fixture is templated, not literal.** Its cross-product `polkadot://` href has to end in the
  suffix the host recognises, or `decideWillNavigate` reads the link as an ordinary navigation and it replaces the tab
  instead of opening a new one. Write `{{TLD}}` in `e2e/test-products/link-tests/index.html`; `startStaticServer`
  substitutes it at startup from the `replacements` the fixture passes.
- **Literal strings stay literal.** The address-bar sanitisation fixtures (`$(localdot.dot)`, `"localdot.dot`, …) are
  malformed _input_, not product names — they are typed verbatim and must not be completed.
- **The spotlight's Tab completion is gated on the app knowing its TLD** — it will not complete a name under the fallback,
  because the completed text is routed against the settled suffix and would resolve nowhere. So assert against the suffix
  the field is _offering_ (`AddressBarPage.expectTabCompletes`, which reads the `inputModalityGhostSuffix` span) rather than
  a hardcoded one: the scenario then verifies that completion happens, on whichever network it runs.

### 8. Pre-launch product seeding (`helpers/seed-products.ts`)

A fresh session persists NO products, so cases that need recents / favorites / a
pinned new-tab grid / a pre-existing dashboard widget were unautomatable. The seed
helpers write directly into the app's Dexie DB (`polkadot-desktop-app-v1`) + the
recents localStorage, so the renderer reads them on its next boot as if the user
had committed them. No chain or auth is needed — works in the no-auth `browser`
project too.

```typescript
import { seedProducts, seedAddressBarRecents, seedDashboardWidget, seedDashboardPages } from '../helpers/seed-products';

// baseNames are full names — complete the label with the project's TLD first (see 7a).
await seedProducts(page, [{ baseName: named('coinflipgame03') }, { baseName: named('x'), withWidget: false }]);
await seedAddressBarRecents(page, [named('coinflipgame03')]); // address-bar + new-tab recents
await seedDashboardWidget(page, named('x')); // single product-widget card on `main`
await seedDashboardPages(page, [named('a'), named('b')]); // one card per page → ≥2 pages (pagination)
await seedRemoteUrlPermission(page, 'localhost:51221', 'https://example.com/'); // Open-External-URL grant
```

**`seedRemoteUrlPermission` is not optional sugar.** E2E builds pass
`promptForUnmatchedRemoteAccess: false` (`src/bootstrap.ts`), so `resolveRemoteUrlAccess`
denies any URL with no stored decision and never raises a dialog for the auto-approver to
answer. A scenario about what the host does with a _permitted_ external URL has to seed the
grant; without it the sandbox logs `External navigation denied by permission` and nothing
reaches `shell.openExternal`.

**API / gotchas for future authors:**

- **Always reload after seeding.** The helpers write through a _raw_ IndexedDB
  connection, which Dexie's `liveQuery` (behind `productsResource` /
  `subscribeToMain`) does NOT observe, and the recents state only re-reads
  localStorage on a fresh boot. So nothing reflects until `page.reload()`. In the
  `browser` project the reload restores `/dashboard` (re-skip onboarding only if it
  bounces — the `the app reloads with onboarding skipped` step does this
  adaptively); an authenticated session reloads straight back to `/dashboard`.
- **`withWidget: false`** seeds a product with no `widget` executable → its
  dashboard widget card renders the "Domain not found" body (`productWidgetNotFound`).
- **The new-tab pinned grid is hardcoded** to the labels `host-playground` /
  `coinflipgame03` / `test-dapp-01`, which the app completes with the network TLD
  — seed those three labels completed the same way (`named()` in
  `browser-seed.steps.ts`) to fill it.
- **Suggestions live in the input surface, not in the address bar.** The bar is a
  button; pressing it opens the spotlight, and `AddressBarPage` drives both halves
  (`open()` / `submit()` / `close()`). The surface renders only what is persisted —
  with nothing seeded its panel collapses, so assert on the surface (`expectSurfaceVisible`)
  rather than on the suggestions unless the scenario seeds products first. The two
  assertable sections are **Recently Opened** and **Saved**; a product already shown
  as a recent is not repeated below, so seed one of each.
- **Cleanup is free** — everything lands in the per-test fresh `userDataDir`, which
  `clearAppData()` already isolates. Nothing leaks between tests.
- **Chat session-seeding lives in a sibling helper** (`helpers/seed-chat.ts`) —
  the chat domain keeps its own standalone Dexie DB (`p2p-chat`), separate from
  `polkadot-desktop-app-v1`. See the next section.

### 8a. Pre-render chat session seeding (`helpers/seed-chat.ts`)

The live P2P attestation/handshake backend is required to establish a real chat
room (peer search → request → accept), so every UI-over-existing-data chat case
(message grouping, the message context menu, edit/reply compose, copy,
delete-conversation, room-list sorting) was unautomatable without it. This helper
writes a chat SESSION + its MESSAGES straight into the chat domain's standalone
Dexie DB (`new Dexie('p2p-chat')`), so a fully populated room renders with NO
live handshake. Uses `authenticatedTest` (single client; no chat pair needed).

```typescript
import { seedChatRooms } from '../helpers/seed-chat';

await seedChatRooms(authenticatedApp.window, [
  {
    peerId: 'seed-peer-alice',
    peerUsername: 'Alice',
    messages: [
      { text: 'Hello there', direction: 'incoming' },
      { text: 'My own message', direction: 'outgoing' },
      { text: 'Yesterday', direction: 'incoming', ageDays: 1 }, // drives date separators
    ],
  },
]);
```

**Minimal record set (verified against `src/domains/chat/p2p`):**

- A **room** row in `rooms` (keyPath `sessionId`): `{ sessionId, peerId, peerUsername, userId,
createdAt, lastUpdate }`. `sessionId === peerId`.
  The rooms stream resource queries `where('userId').equals(userId)`, so the room is
  only visible under the **signed-in user's id**.
- **message** rows in `messages` (keyPath `messageId`): `{ messageId, sessionId,
peer, timestamp, content: {type:'text', text}, status, lastUpdate }`. A message
  belongs to a room when its `sessionId` equals that room's `peerId`. `status` is
  `{direction:'outgoing', state:'delivered'}` or `{direction:'incoming', state:'seen'}`.
- **No crypto / session keys are needed.** The room renders from the rooms+messages
  resources alone; the live `manager` only needs to _exist_ (the chat list returns
  `[]` while `p2pChatManager$` is null), and it comes up post-sign-in from the local
  SSO identity even with the backend down (its subscriptions are fire-and-forget,
  `startSession` is catch-wrapped).

**API / gotchas:**

- **The seed `userId` is read at runtime** from `window.__p2pV2Debug.userId` (the
  manager publishes it). `seedChatRooms` blocks on `waitForChatManager` until that
  appears — which also guarantees the `p2p-chat` DB + object stores exist (created
  lazily on the manager's first read). So **seed only after sign-in**, never pre-launch.
- **Reload is mandatory** (same `seed-products.ts` gotcha): the rooms/messages stream
  resources read through Dexie `liveQuery`, which does NOT observe the raw IndexedDB
  writes. `seedChatRooms` reloads + navigates home + re-awaits the manager for you.
- **Use it for UI-over-data only.** A seeded room has no contact roster / session keys,
  so any action that hits `session.sendMessage` (sending, the reaction round-trip)
  throws — those stay on the two-client `chat-p2p-pair` suite. `deleteSession`
  (delete-conversation) works because its `startSession` is catch-wrapped and it
  proceeds to the local teardown regardless.
- **Cleanup is free** — everything lands in the per-test fresh `userDataDir`.

## Rules

- **Page Objects over raw selectors** — all UI interaction goes through page objects
- **`TEST_IDS` for data-testid** — shared between `src/` components and `e2e/` tests, never hardcode strings
- **`clearAppData()` before every test** — for fresh-per-test projects (smoke/auth/`@isolated`); the `authenticated` worker session uses the soft-reset instead (`helpers/reset-state.ts`)
- **Parallelism is opt-in per project, controlled by the npm scripts.** The config default is `CI ? 4 : '50%'`; **authenticated, chat and product-sdk** run at it (their scripts pass no `--workers`). `authenticated`/`product-sdk` reuse one signed-in Electron per worker, each claiming its own signer slot by `parallelIndex` (no pool, no cross-worker collision — see "Signer identities" below); `chat` does the same for its single-client scenarios, and its pair tests cycle a bounded per-worker pool of `chatpair-w<slot><a|b>` slots. **`smoke`, `auth` and `security` pin `--workers=1`** — `security` because concurrent Electron teardown hangs on the macOS runner, `auth` because its slot warming is pinned to one worker, `smoke` as a quick serial gate. **`browser` and `link-navigation` pin `--workers=2`** — both are no-auth but CPU-bound rather than chain-bound (every test drives a real product webview), so they gain nothing from more workers and at 4 they destabilise, webviews failing `dom-ready`; they finish in ~6 and ~2 minutes either way. Those two plus `smoke` also carry `timeout: 150_000`: the onboarding chrome they wait on is chain-gated and the page objects budget it at `VERY_LONG_TIMEOUT`, so under the global 60s test timeout the test dies first and reports `Test timeout exceeded` instead of the locator that was pending. **`authenticated` and `chat` MUST NOT be pinned without raising their job timeout** — at 2 workers both exceeded 45 minutes and CI killed them, where at 4 they take ~34 and ~28. A project pinned here MUST also get an entry in `WORKERS_FOR` in `e2e/setup/signers.setup.ts`: that module reads `E2E_WORKERS` and cannot see the `--workers` flag, so without it the warm-up attests slots no worker will ever claim. Override anywhere with `E2E_WORKERS` or `--workers`
- **Soft-reset baseline snapshot** (`resetToAuthenticatedBaseline`) — `localStorage` is snapshotted right after the worker signs in (`captureLocalStorageBaseline`) and the per-test reset is `localStorage.clear()` + restore that snapshot, plus `sessionStorage.clear()`. It names **no storage keys** — not the session's, not the app's. New persisted localStorage state therefore needs no change here, and a test that mutates a baseline key (theme, settings) is rolled back too. IndexedDB is still cleared per store, so **new object stores do need registering** (app-DB stores `products`, `dashboardLayouts`, `productStorage`, `productExecutableCache`; the `p2p-chat` + `products-chat` DBs). `coreStorage` is deliberately NOT cleared — it holds the worker's core auth session; wiping it logs the worker out (see `reset-state.ts`). Permissions moved into `coreStorage` (core-owned), so they now persist across the worker session rather than resetting per test
- **Never spell a dotNS suffix in a test.** Feature files carry the product **label**; the step completes it through `productName` from `helpers/dotns.ts` (see writing-tests 7a). The suffix is per-environment, so a hardcoded one passes on one channel and resolves nothing on the next
- **Allure tags in .feature files** — control report hierarchy, not file paths
- **`@allure.id:<n>` links a scenario to TestOps plan 900** — scenario name = `TC-x.y.z <title>`, one id per scenario (see writing-tests "Linking a scenario to its TestOps case" and the case map in `docs/regression-testplan-900-cases.md`)
- **`@manual-permissions` tag** — opts out of the renderer-side permission/alias dialog auto-approver (see writing-tests section 6). Use only when the test asserts on the dialog itself
- **`suiteTitle: false`** in Allure config — suite names come only from Gherkin tags
- **Sign-in drives a local `truapi-host`, not a service.** The app publishes its pairing deeplink as a `data-pairing-deeplink` attribute on the onboarding QR container (`src/features/onboarding/ui/OnboardingScreen.tsx`, AUTOTEST-gated — the attribute is absent entirely outside autotest). `OnboardingPage.pairingDeeplink()` reads it and hands it to `SigningHost.pair()`, which spawns `truapi-host signing-host --serve --deeplink …`. Install the CLI with the installer in `.env.example`; override the binary with `TRUAPI_HOST_BIN` to test an unreleased fix.
- **Signer identities are addressed by directory, not by name.** Each slot is one `--base-path` under `.truapi-host/` (override with `TRUAPI_HOST_BASE_PATH`): `<project>-w<parallelIndex>/` for the worker-scoped fixtures, and `chatpair-w<slot><a|b>/` for the two-client chat pair. `--session` never selects an identity: it is passed only on a slot with no identity yet (`slotHasIdentity`), to name that identity's fresh base. On a provisioned slot it is omitted and the CLI restores the session on disk — passing a new base there would mint a second identity every run. A directory is a thing this harness owns outright. **Each slot directory holds a plaintext 0600 mnemonic — the tree is gitignored and must stay that way.**
- **`setup-signers` warms the slots before the tests.** It runs `--serve` against each slot the invoked projects will claim and stops once the host reports ready; starting the host is the only thing that provisions. On a warm tree a slot restores in seconds, on a cold one it pays an on-chain attestation that would otherwise land inside a test's timeout. `E2E_SIGNER_PROJECTS` (set by the per-project npm scripts) scopes which slots get warmed — warming all of them on `npm run test:e2e:auth` would attest identities the run never touches, each one spending a chain attestation and a daily allowance slot. `E2E_PROVISION_CONCURRENCY` (default 4) bounds how many attest at once. **A slot that fails to warm does not fail the setup** — it is logged and annotated, and provisions inside the first test that claims it; one chain-side attestation flake must not block a whole project.
- **Every identity is minted under its own username base.** `--session` on a slot with no identity takes a _base_ (truapi-host 0.25 removed `--lite-username-prefix`; with no `--session` a fresh slot falls back to the CLI's shared `headless` base), and a base is a finite chain-level pool: the identity backend answers `EXHAUSTED` once its 99 discriminators are owned, and equally once the bare name is owned or its reservation queue (capacity 10) is full. `truapi-host` turns anything but `AVAILABLE` into `lite username "<base>" is taken` and refuses to provision, which stops every slot at once — one fixed base did exactly that on 2026-09-17 across all four signer-backed projects. `freshLiteUsernameBase()` (`e2e/helpers/signing-host.ts`) mints `truapitest` + 10 random letters per call, so no two identities share a pool; the stem keeps registrations attributable. **Never reintroduce a shared constant base.**
- **Never kill a provisioning `--serve`.** The username registration is POSTed within the first seconds of startup and nothing local records that it happened, so any interrupted cold start strands an attested identity the tree cannot address and spends one of its daily allowance slots, with no trace. This is why `READY_TIMEOUT_MS` in `e2e/helpers/signing-host.ts` is deliberately generous and must not be tightened.
- **Teardown removes the slot's devices, and this is not hygiene.** `truapi-host` refuses to rotate an identity while any paired device still depends on it, so a pairing left behind by a finished run blocks recovery the next time that identity's daily allowance budget runs out. Order matters: stop the process first, then clear the pairings.
- **Claim confirmation.** `e2e/helpers/identity-backend.ts` asks the identity registry whether a username claim landed — the same source the app's contact search reads, so a claim it confirms is one the UI can find. `findRegistrations` returns `null` for "could not tell" (no `E2E_IDENTITY_URL`, request failed, 402) and `[]` for "definitively not registered"; **callers must never read `null` as unregistered**. With no registry configured the harness falls back to the username `truapi-host` prints on its own startup line, which already carries the backend-assigned suffix.
- **Reset, not heal:** a sign-in wedged in pairing (`StuckPairingError` — chain redeploy) or rejected with the "Limit Reached" no-free-slots error (`PairingLimitError` — exhausted 10/day allowance-slot budget, detected fast from the onboarding error panel; retries abort immediately since the budget is daily) clears the signer's saved pairings and retries (`signInWithReset` in `e2e/helpers/sign-in.ts`). There is no permanent-vs-random distinction any more — every slot is a durable identity.
- Auth steps use `"the user signs in on {environmentId}"` / `"the user is signed in on {environmentId}"`, where `{environmentId}` is a `VITE_ENVIRONMENTS` channel key — currently `nightly` or `unstable`; see `e2e/helpers/environment.ts`. There is no identity argument: the worker's slot directory decides which identity signs in.
- **Failure artifacts** — fresh-per-test projects (smoke/auth/browser/link-nav) use the test-scoped `electronApp` fixture from `base.ts`: on failure it attaches `screenshot` (PNG) and, on retry (`testInfo.retry > 0`), a `recordVideo` `.webm`. The `authenticated` worker session attaches a per-test failure `screenshot` against the shared app; the app is shut down once at worker teardown (not per test), so retry-video isn't recorded for it. `@isolated` and `product-sdk` `@isolated` paths get a fresh app + per-test screenshot.
- **Cucumber VS Code extension** — configured via `.vscode/settings.json` for step navigation

## Commands

```bash
npm run build:e2e              # Build app for e2e (AUTOTEST + filesystem renderer)
npm run test:e2e:gen           # Regenerate BDD specs from .feature files
npm run test:e2e               # Smoke tests
npm run test:e2e:auth          # Auth flow tests (sign-in, logout)
npm run test:e2e:authenticated # Authenticated session tests
npm run test:e2e:chat          # All chat tests (single-client contact search + two-client Alice+Bob pair)
                               # Warms its signer slots first via the `setup-signers` project.
npm run test:e2e:all           # All BDD tests (smoke → auth → authenticated → product-sdk → chat → link-navigation → browser)
npm run test:e2e:browser       # Browser-chrome tests (zoom, find, … — link-tests product, no auth)
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
- **`playwright.config.ts`** — only when adding a new project or a feature that needs a new step file; feature files
  in an existing project folder are picked up by that project's glob automatically.

Changes that require doc updates:

| Change                                | Update                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| New test project (e.g. `performance`) | Both docs + `playwright.config.ts` + `package.json` scripts                           |
| New fixture (e.g. worker-scoped)      | Both docs (fixture API section)                                                       |
| New Page Object                       | `e2e/README.md` (directory structure)                                                 |
| New convention or rule                | `e2e/CLAUDE.md` (Rules section)                                                       |
| New npm script                        | Both docs (Commands section) + `CLAUDE.md` (Commands section)                         |
| New `data-testid`                     | `src/shared/test-ids.ts` only (docs describe the pattern, not individual IDs)         |
| A deployment's dotNS TLD changes      | `e2e/helpers/dotns.ts` only — one map, no test edits (or `E2E_DOTNS_TLD` for one run) |
