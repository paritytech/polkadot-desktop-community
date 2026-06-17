# Project structure

Polkadot Desktop is an Electron app with three build targets:

- `main` — Electron main process (Node.js sandbox).
- `renderer` — the web application.
- `preload` — bridge between Electron and the browser environment. Source lives under `main/`.

## Top-level directories

```
├── scripts/   build scripts and helpers
├── config/    build configuration
├── e2e/       end-to-end tests
├── docs/      dev documentation
├── main/      main process and preload
└── src/       renderer
```

## Main process

```
└── main/
    ├── factories/   Electron factories (window, menu, updater, etc.)
    ├── shared/      constants and utilities for the main process
    └── preload.ts   preload script
```

## Renderer

```
└── src/
    ├── domains/      core business logic and data layer
    ├── aggregates/   cross-domain runtime state and data flow
    ├── features/     user-facing flows (UI + state)
    ├── widgets/      cross-feature composite UI
    ├── routes/       TanStack Router file-based routes
    ├── shared/       shared libraries (components, di, hooks, resource, rxstate, dexie, env, translation, utils)
    ├── App.tsx       root React application
    └── bootstrap.ts  feature registration and app init
```

---

## Where each artifact sits

The static dependency rules — what each artifact may import and who may import it. For the runtime traces that show these artifacts interacting in sequence, see [architecture.md](./architecture.md); for deciding which artifact a given piece of code _is_, see [code-placement.md](./code-placement.md).

| Artifact                           | Role                                           | Imports allowed                                           | Imported by                                               |
| ---------------------------------- | ---------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| `gateway.ts`                       | leaf — wire I/O                                | schemas, shared utils                                     | resources, use cases (own domain only via public surface) |
| `repository.ts`                    | leaf — persistence                             | `@/shared/dexie`, types                                   | resources (own domain only)                               |
| `schemas.ts`                       | leaf — boundary validation                     | `valibot` / scale codecs                                  | gateways, resources, use cases                            |
| `service.ts`                       | leaf — pure helpers                            | types only                                                | anywhere, including features                              |
| `resource.ts`                      | composes gateway + repository                  | gateway, repository, service (+ a multi-source use case, only to cache its read — see below) | hooks, use cases                                          |
| `$usecase/*.ts`                    | composes ≥2 resources/repos/gateways/use-cases | everything in the domain + other domains' public surfaces | hooks, other use cases                                    |
| `hooks.ts` / `$usecase/*.hooks.ts` | React binding via `useRead` / `useAction`      | resources, use cases, services                            | features, widgets, aggregate hooks                        |
| aggregate `state/`                 | RxJS state                                     | `@/shared/rxstate`                                        | aggregate use cases, aggregate hooks                      |
| aggregate `*UseCase.ts`            | composes domain surfaces + own state           | domain public surfaces, own state                         | aggregate hooks                                           |
| feature UI / hooks                 | calls domain + aggregate hooks                 | domain + aggregate public surfaces, DI primitives         | route, other features only via DI                         |

If a piece of code crosses two rows of this table (e.g. a resource that talks to another domain's resource, or a feature that
imports a repository), it is in the wrong file.

**The one carve-out — a resource over a use case.** A `resource.ts` may import a use case in exactly one case: to add a cache /
subscription lifecycle over a read that is _genuinely multi-source_ (the use case composes ≥2 sources, e.g. DB + chain). The
resource adds nothing but caching; all orchestration stays in the use case. This is the permitted direction in
[anti-pattern #2](#anti-patterns) — not the inverted shape it forbids. It does **not** license a resource to call a single-source
use case (inline the source instead), nor a write/mutation that composes a use case to live in `resource.ts` (that write is itself
a use case by the [cut rules](./code-placement.md#cut-rules) and belongs in `$usecase/`).

---

## Deciding where code goes

Which layer, which file within it, the cut rules, and which binding hook to use have moved to [code-placement.md](./code-placement.md) (the reference paired with the `code-placement` skill). The dependency-rule companion — what each artifact may import and who may import it — is the [Where each artifact sits](#where-each-artifact-sits) table above.

---

## Domain

Owns business logic and the data layer (fetching, caching, persistence), independent of UI. **No runtime state** — selections and
in-progress flows are aggregate concerns. See [domain-development.md](./domain-development.md) for the development workflow.

### Module recursion

A module is either a **leaf** (no sub-modules, no `index.ts`) or a **container** (1+ sub-modules, mandatory `index.ts`).

- Sub-modules are peers of the container's own files and may import each other directly.
- The container's `index.ts` is the canonical public surface — re-exporting it from the domain `index.ts` is preferred — but deep
  imports into a sub-module are not forbidden.
- The container's own files coexist with sub-modules; its `service.ts` typically composes from sub-module services.

Sub-modules follow the same contract recursively. 1 level is common, 2 rare, 3+ usually signals the model needs reworking (extract
a domain).

**Trigger to nest** — the module's `service.ts` / types group into 2+ unrelated clusters of terms, but the new vocabulary still
belongs _inside_ the parent's concept. If it doesn't, make it a sibling module or a new domain.

### Folder structure

```
└── domains/{DOMAIN_NAME}/
    ├── $usecase/                    # cross-source orchestration (optional, domain root only)
    │   ├── {groupName}.ts             # ${groupName}UseCase + co-located DI side effects
    │   └── {groupName}.hooks.ts       # React wrappers for the group's use cases
    ├── {LEAF_MODULE}/                 # no index.ts
    │   ├── types.ts
    │   ├── service.ts
    │   ├── resource.ts
    │   ├── hooks.ts
    │   └── ...
    ├── {CONTAINER_MODULE}/
    │   ├── {SUB_MODULE}/              # leaf or container, same contract
    │   ├── service.ts                 # parent surface, may compose from sub-modules
    │   ├── types.ts
    │   ├── README.md                  # optional, only if sub-vocabulary needs framing
    │   └── index.ts                   # required
    ├── bootstrap.ts                   # optional, domain root only — host-environment wiring
    ├── README.md                      # required at domain root
    └── index.ts                       # required at domain root
```

### File contracts

**`README.md`** — frames vocabulary, scope, and boundaries. This is the domain's **glossary and ubiquitous language**: the
canonical name for each concept the domain owns, and — where a concept has tempting synonyms — the term to use and the ones to
avoid (e.g. in an accounts domain: `account` vs `address` vs `signatory`; in a transactions domain: `extrinsic` vs `tx` vs
`call`). One concept, one name, used identically in code, design, and product talk. The README is the source of truth for that
naming; resolve any drift here first. External documentation links (specs, RFCs, API docs) live here too. No file layout, no
function signatures. Structure it with the [`DOMAIN_README.md` template](../template/DOMAIN_README.md) (Overview → Vocabulary →
Scope → Flows → Boundaries → References).

**`index.ts`** — canonical public surface. Required at the domain root and every container; forbidden in leaves.

**`types.ts`** — TypeScript types only. Types derived from a Valibot schema or SCALE codec live in `schemas.ts`. Cross-module
types belong in a shared module or `@/shared`.

**`constants.ts`** — static compile-time values (enums, defaults, lookup tables). No I/O.

**`schemas.ts`** — schemas for data crossing trust boundaries (API responses, user input, IPC messages, on-chain payloads,
persisted blobs being read back).

- Valibot for JSON-shaped data: compose with `v.pipe(...)`, derive types via `v.InferOutput`, parse with `v.parse(schema, x)` /
  `v.safeParse(schema, x)`.
- SCALE codecs (`@polkadot-api/substrate-bindings`, `@novasamatech/scale`, `scale-ts`) for binary chain/P2P payloads.
- The schema/codec is the source of truth — derive TypeScript types from it, not the other way around.
- Apply only at the boundary. Don't re-validate values the codebase itself produces and has already typed.

**`service.ts`** — single `${entityName}Service` object of **stateless synchronous helpers** on already-loaded entities
(predicates, formatters, derivations).

- Public: importable directly from features, widgets, and routes.
- No imports of resources, mutations, or repositories. No I/O.
- Any function that meets the use case [cut rule](./code-placement.md#cut-rules) is a use case, not a service method.
- May _express_ a business rule as a predicate (`canAddToDashboard(...)`), but cannot _enforce_ an invariant — it owns no write.
  Enforcement is a use case's job (see [`$usecase/`](#file-contracts)).

```ts
function isChainAccount(account: AnyAccount) {
  /* ... */
}
export const accountService = { isChainAccount /* ... */ };
```

**`resource.ts`** — cached/streamed reads built with `createQueryResource` / `createStreamResource` from `@/shared/resource`.
Caching, retries, and subscription lifecycle live here.

- Multiple resources per file are fine. Features reach them only through `hooks.ts`.
- Persistence calls `repository.ts`. External I/O calls `gateway.ts`.
- Mutations are plain Observable-returning (or async) functions exported here or from `$usecase/`. Consumed via `useAction`. No
  primitive wrapper.

**`gateway.ts`** _(optional, for stateless external I/O — RPC, HTTP, IPFS, P2P — that doesn't fit a resource cache)_ — single
`${entityName}Gateway` object of adapter functions.

- Wire boundary: takes plain inputs, performs I/O, validates through `schemas.ts`, returns domain-typed values.
- Public. No caching/lifecycle (→ `resource.ts`), business logic (→ `service.ts`), or state.

**`repository.ts`** _(optional, when persisting to IndexedDB/localStorage)_ — Dexie/storage declarations and thin query/mutation
helpers. Consumed by `resource.ts` only. No business logic. A localStorage-backed repository may persist through
`persistLocalStorage` from `@/shared/rxstate` (exposing an `RxState` stream the resource subscribes to) instead of hand-rolling
storage I/O — this is the one place outside an aggregate's `state/` where `@/shared/rxstate` is expected.

**`hooks.ts`** — thin `useX` React hooks built on `useRead` (and `useAction` for mutations) from `@/shared/hooks`. Each provides a
stable named domain entry point (e.g. `useProducts`, `useProductById`, `useSendMessage`) handling parameter nullability and the
`defaultValue` / `map` boilerplate so features call `useProducts()` instead of restating the resource + options inline. No
business logic — call `service.ts` for transformations. Bind to resources, use cases, and services only — never `repository.ts`
or `gateway.ts` directly; persisted/wire data reaches a hook through a resource. Pure-UI / feature-local hooks belong in the
feature. Orchestration belongs in `$usecase/`, not here — see the carve-out in [React-binding hooks](./code-placement.md#react-binding-hooks).

> **A deliberate trade-off — the domain is _not_ UI-framework-pure.** Strictly, the domain layer should not depend on the UI
> framework at all (so the business core stays portable and testable without React). `hooks.ts` breaks that on purpose: it imports
> React (via `useRead` / `useAction`). We accept this because development ergonomics win — exposing a stable `useX` entry point in
> the domain means every consuming feature/widget calls `useProducts()` instead of re-deriving `useRead(resource, {...})` at each
> call site, which is where drift and boundary leaks actually start. The cost is contained: `hooks.ts` is the **only** React-aware
> file in the domain, and it stays a thin binding — no business logic, no orchestration. The portable core (`service.ts`,
> `resource.ts`, `gateway.ts`, `repository.ts`, `$usecase/`) remains React-free and independently testable, so the purity we gave
> up is recoverable by ignoring one file. If a "domain must not import the UI framework" fitness function is ever added, scope it
> to everything in the domain **except** `hooks.ts` / `*.hooks.ts`.

**`$usecase/`** _(optional, at the domain root only — not inside modules)_ — operations meeting the use case cut rule. Each file
is a category of related operations (`resolve.ts`, `installation.ts`, `lifecycle.ts`) and exports one `${groupName}UseCase`
object.

- **Method names** are `<verb><Noun>` (`installProductAndAddToDashboard`). Local functions stay private — outside callers go
  through the group object.
- **I/O types** reuse the relevant module's `types.ts`. Use-case-local types only for complex multi-module compositions. Never
  React, UI, or Electron/IPC types.
- **Return**: `Promise<T>` for atomic completion, `Observable<T>` for multi-stage status or live-updating reads, raw value for
  synchronous (rare).
- **Composition**: may call other use cases, services, resources, repositories, gateways.
- **Invariants**: a use case is the **enforcement chokepoint** for the domain's business invariants — the rules that must hold
  for the entity to be valid (e.g. "a product is on the dashboard at most once", "a transfer amount ≤ spendable balance"). Check
  the invariant here, before the write, and reject the operation if it would break (throw / return an error result). Enforce each
  invariant in exactly **one** use case — never re-check the same rule ad hoc inside features, hooks, or components; a rule
  scattered across call sites is a rule that eventually a path forgets. A `service.ts` predicate may _express_ the condition
  (`canAddToDashboard(...)`), but only the use case, owning the write, can _enforce_ it. This is distinct from `schemas.ts`, which
  validates _shape_ at a trust boundary (well-formed input) — invariants are _business validity_ given current domain state.
- **DI side effects** (`createSideEffect`) live at the top of the group file and are re-exported from the domain `index.ts`.
- **React entry**: a `use<VerbNoun>` hook per use case in the sibling `${groupName}.hooks.ts`, built on `useAction`
  (writes/commands) or `useRead` (reads).
- **Restriction**: orchestration only. No resources, mutations, or other artifact types live inside `$usecase/`.

```ts
// domains/product/$usecase/installation.ts
import { createSideEffect } from '@/shared/di';
import { type Product, type PersistedProduct } from '../product/types';

const onProductForgottenSideEffect = createSideEffect<{ productId: string }>({ name: 'onProductForgotten' });

async function installProductAndAddToDashboard(params: InstallParams): Promise<PersistedProduct | undefined> {
  /* ... */
}
async function ensureProductExists(productId: string): Promise<void> {
  /* ... */
}

export const installationUseCase = {
  onProductForgottenSideEffect,
  installProductAndAddToDashboard,
  ensureProductExists,
};
```

**`bootstrap.ts`** _(optional, at the domain root only)_ — wires the domain to the host environment: registering IPC request
handlers, bridging native event subscriptions into the domain. Exports `bootstrap<Action>` functions (`bootstrapProduct`); the
domain-root file composes per-module bootstraps (`bootstrapPermissions`) and is the canonical entry point, re-exported from the
domain `index.ts`.

- **Called once from the app `bootstrap.ts`** — never at module-import time, so host wiring and its load order stay explicit (no
  hidden side effects on import).
- **Environment knowledge is injected**, not read here: pass config (e.g. test-mode flags) from the app boundary rather than
  importing `@/shared/autotest` or `@/shared/env` switches into the domain.
- **Restriction**: wiring only. The handler bodies delegate to resources / services / use cases — no business logic lives in
  `bootstrap.ts`.

---

## Aggregate

A **cross-feature, cross-domain reusable data-flow module** — the data-flow reflection of a widget. Examples: `browser-tabs`,
`network-settings`, `product-loading`, `product-workers`, `webview-registry`.

**Constraints**:

- Built on `@/shared/rxstate` + RxJS.
- May depend on domains and other aggregates; never on features/widgets/routes.
- Owns no _backend_ persistence (gateways, repositories, resource caching, schemas → domain). **May** persist runtime state to
  localStorage / sessionStorage via `persistLocalStorage`.
- Must own meaningful cross-cutting runtime state. May bridge external events (Electron IPC, native subscriptions) into that state
  through a use case. A one-off shared callback channel with no state of its own is not an aggregate — use `createSideEffect` or
  feature-local plumbing.

**Escape hatches** (when an aggregate is the wrong fit):

- Single-feature state → `features/{feature}/state/`.
- Persistent, entity-shaped data → a domain.

### Folder structure

Aggregates are deliberately flatter than domains — no README, no `service.ts`, no `$usecase/` subfolder.

```
└── aggregates/{AGGREGATE_NAME}/
    ├── index.ts                # required; canonical public surface
    ├── state/                  # required; RxJS state via @/shared/rxstate
    ├── <name>UseCase.ts        # cross-domain orchestration; one file per use-case group, at the root
    ├── hooks.ts                # React adapters: state selectors AND use-case bindings, in one file
    ├── ui/                     # optional; headless binding component(s) only — see below
    ├── types.ts                # aggregate-local types (optional)
    └── constants.ts            # compile-time values (optional)
```

`index.ts` and `state/` are required; everything else is optional. Pure-state aggregates can stop at those two.

When an aggregate's orchestration must run inside the React lifetime (e.g. route↔state sync that reacts to the router), it may
expose a single **headless binding component** under `ui/` — a `() => null` component that drives a `<name>UseCase` method from
`useEffect`/`useRxState` and renders nothing. This is the React-only carve-out applied to an aggregate; it is the one exception to
"aggregates own data flow, not UI." Anything that actually renders is a widget or a feature, never an aggregate.

### File contracts

**`index.ts`** — re-exports state objects, `<name>UseCase` objects, and hooks. Internal helpers and raw RxJS subjects stay
private. `RxState` instances are exposed directly (their `.value$` / `.set` API is canonical).

**`state/`** — split across files as needed (no nested `index.ts`). Built on `createState` / `createEvent` / `combine` from
`@/shared/rxstate`. Exports one object named after the aggregate (`browserTabs`, `webviewRegistry`). Raw `BehaviorSubject` /
`Subject` stay internal. For state that survives reloads, use `persistLocalStorage`.

**`<name>UseCase.ts`** _(at the aggregate root)_ — cross-domain orchestration. Exports one `<name>UseCase` object per file. Same
contract as a domain `$usecase/{group}.ts`:

- Methods compose domain resources, services, and other use cases. `<verb><Noun>` names.
- `Promise<T>` return for atomic completion; `Observable<T>` for multi-stage / live-updating.
- May bridge external events (Electron IPC, native subscriptions) into the aggregate's `state/`.
- DI side effect identifiers (`createSideEffect`) co-located at the top of the file.

**`hooks.ts`** — React adapters in a single file, two kinds together:

- **State selectors** via `useRxState` over `state/` objects.
- **Use-case bindings** via `useAction` / `useRead` over `<name>UseCase` methods.

No subfolder split. Orchestration belongs in `<name>UseCase.ts`, not here — see the carve-out in
[React-binding hooks](./code-placement.md#react-binding-hooks) for the one exception (React-only inputs).

**`types.ts`**, **`constants.ts`** — same contracts as in a domain.

---

## Feature

Links domain logic to the user — one or several tightly coupled user flows + their UI, composed via DI into larger flows. See
[feature-development.md](./feature-development.md) for the workflow.

**Rules**:

- Export a feature identifier from `createFeature`. Integrations declared via `feature.inject(...)`.
- **May** export stateless presentational components for use in this feature's slots by other features (must stay stateless —
  anything stateful is a widget or its own feature).
- **Must not** export stores or data-access logic.
- No new Effector code (deprecated).

### Folder structure

```
└── features/{FEATURE_NAME}/
    ├── index.ts      public exports
    ├── feature.tsx   feature definition and slot injections
    ├── ui/           UI components
    ├── hooks/        feature-specific orchestration hooks
    ├── state/        feature-local state (never exported)
    ├── di.{ts,tsx}   DI identifiers
    ├── types.ts      feature-shared types
    └── constants.ts  feature-shared constants
```

All optional — include only what's needed.

### File contracts

**`index.ts`** — re-exports the feature identifier, DI extension points the feature defines, intentionally-public components.
Events, resources, services, and data-access logic are never re-exported.

**`feature.tsx`** — calls `createFeature` (name format `domain/feature`, e.g. `'chat/product'`) and wires injections. Register
every feature in `src/bootstrap.ts`.

```tsx
import { createFeature } from '@/shared/feature';

export const dashboardFeature = createFeature({ name: 'application/dashboard' });
dashboardFeature.inject(topBarLeftSlot, { order: 0, render: () => <HomeButton /> });
```

**`ui/`** — React components. Read via domain/aggregate hooks; dispatch via feature state, use cases, or aggregate hooks.
Domain/aggregate services may be imported directly. No resource definitions.

**`hooks/`** — feature-specific orchestration. Hooks that merely wrap a domain resource belong in the domain. One-component hooks
should be inlined.

**`state/`** — feature-local RxJS state coordinating the UI. Never exported. Don't persist here — if it must survive reloads, it's
a domain resource.

**`di.{ts,tsx}`** — feature-specific DI identifiers exported as public API. Use `.tsx` only when an identifier ships default JSX.

**`types.ts`**, **`constants.ts`** — types and compile-time values shared across the feature.

---

## Widgets

State-aware UI components consumed by multiple features — the escape hatch when a feature-shaped UI is reused often enough that
direct import beats slot/DI threading.

**Rules**:

- Self-contained React component(s) importable from `@/widgets/{WidgetName}`.
- Bind to state via domain/aggregate hooks. No `createFeature`, no slot injections, no resources/services/persistence of their
  own.

**Widget over `@/shared/components`** when it reads/writes app state — `@/shared/components` must stay stateless.

### Folder structure

```
└── widgets/{WidgetName}/
    ├── index.ts            public exports
    ├── {WidgetName}.tsx    root component
    ├── ui/                 internal subcomponents (optional)
    ├── hooks.ts            widget-local hooks (optional)
    ├── types.ts            widget-local types (optional)
    └── constants.ts        widget-local constants (optional)
```

### File contracts

**`index.ts`** — re-exports the root component and prop types only. No internal subcomponents, hooks, or app state.

**`{WidgetName}.tsx`** — thin root component (orchestration + prop wiring). `memo` when mounted inside frequently re-rendering
parents.

**`ui/`** — internal subcomponents, not exported. Promote cross-widget UI to `@/shared/components`.

**`hooks.ts`** — hooks used only by this widget; may combine state from domain/aggregate hooks.

**`types.ts`**, **`constants.ts`** — same contracts as features.

---

## Shared

`@/shared` is the bottom of the dependency graph — small, self-contained libraries depending on nothing above. Each subdirectory
is one library with a single `index.ts` public surface. Consumers import from `@/shared/{library}`, never internal paths.

**Rules**:

- Domain-agnostic (no knowledge of accounts, products, chats, etc.). Generic — helpers operate on what their signatures describe;
  components render whatever props they get.
- No business logic, no app-specific state reads/writes, no exported module-level stores/subjects/singletons. Expose factories;
  consumers own instances.
- No dependency on `@/domains`, `@/aggregates`, `@/features`, `@/widgets`, or `@/routes`.

**When to add**:

- Helper needed by 2+ layers, no entity knowledge → `@/shared/utils` or a new library.
- Primitive abstracts a technology, not a domain (IndexedDB, RxJS, i18n) → its own `@/shared/{library}`.
- Reusable presentational component → `@/shared/components`.
- Helper hardcodes an entity → it belongs in a domain instead.

**Current libraries**:

- `@/shared/utils` — pure functions over primitives and collections.
- `@/shared/hooks` — generic React hooks (`useRead`, `useAction`, plus DOM/intersection/etc. helpers).
- `@/shared/components` — presentational components.
- `@/shared/resource` — `createQueryResource` / `createStreamResource` primitives consumed by domain `resource.ts`.
- `@/shared/rxstate` — `createState`, `createEvent`, `combine`, `persistLocalStorage` consumed by domain/aggregate `state/`.
- `@/shared/di` — slot/pipeline/SDK primitives consumed by `feature.tsx`.
- `@/shared/translation` — i18n setup and `useTranslation`.
- `@/shared/dexie` — IndexedDB wrapper consumed by domain `repository.ts`.
- `@/shared/env` — environment detection (web/Electron) and build-mode detection (`isDev`, `isProductionBuild` —
  the latter reads the `BUILD_MODE` define because the renderer vite config remaps staging to Vite's
  `production` mode, so `import.meta.env.MODE` alone cannot tell the two apart).
- `@/shared/logger` — `silenceDebugConsole`, the app-level switch that mutes `console.debug` in production builds
  (called once from `src/index.tsx`).

---

## Anti-patterns

Codebase-wide rules. The cut rules above say where things belong; this section says what NOT to do.

1. **Single-line passthrough use case** — a `${name}UseCase` whose only method calls one resource. Inline at the caller; the
   wrapper buys nothing.

2. **Resource wrapping a single-source use case** — use cases compose resources; the reverse is allowed _only_ when the use case
   genuinely orchestrates multiple sources and the resource adds nothing but caching (the carve-out under
   [the artifact table](#where-each-artifact-sits)). Wrapping a single-source use case in a resource buys nothing —
   inline the source.

3. **Inline `useRead(resource, {...})` at a feature callsite** — features call named domain hooks (`useProducts`,
   `useProductById`). The `useRead` indirection lives in the domain's `hooks.ts`.

4. **Domain `hooks.ts` doing feature-specific shaping** — if a hook only matters for one feature, it belongs in that feature's
   `hooks/`.

5. **Aggregate persisting backend data** — backend persistence is the domain's job. Aggregates persist _runtime_ state
   (selections, in-flight flags) to localStorage via `persistLocalStorage` only.

6. **Cross-impl coupling** — domains don't import from aggregates / features / widgets / routes. Aggregates don't import from
   features / widgets / routes. Features may consume aggregates and domains but never export shared stores.

7. **Mutation primitive wrapper** — there is no `createMutation`. Writes are plain functions; React binding is `useAction(fn)`.

8. **`hooks.ts` reaching into `repository.ts` / `gateway.ts`** — hooks bind to resources, use cases, and services only. A repository or gateway is consumed solely by a `resource.ts` (or a use case). A hook that needs persisted or wire data reads it through a resource — never the storage/wire leaf directly.
