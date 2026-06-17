# application

The `application` domain owns the cross-cutting plumbing every other domain and feature leans on: the active deployment
environment, the dashboard layout, the imperative command bus, the Statement Store transport, and the Papp (Polkadot
mobile) host bridge.

It is the seam between the host shell (Electron or web) and the rest of the renderer. Anything that crosses that seam — a
command-bus invocation, a Papp adapter handshake, a statement-store submission, an environment switch, a dashboard
mutation — passes through here.

## Vocabulary

### Environment

- **Environment** — A named, end-to-end deployment of the Polkadot stack: a People chain (statement-store), a Bulletin
  chain, an Asset Hub hosting the dotNS resolver contract, and the identity backend that drives push notifications. One
  environment is active at a time. Full contract: [`environment/README.md`](./environment/README.md).
- **EnvironmentId** — String discriminator persisted in `localStorage`. Current values: `previewnet`, `paseo-next`,
  `paseo-next-v2`.

### Commands

- **Command** — A serializable imperative request that crosses a feature boundary without a direct import. Features
  publish commands; other features (or domain use cases) subscribe. `commandsService` is the registry; identifiers are
  declared per-consumer. Used when DI slots/pipelines don't fit because the call is fire-and-forget across an opaque
  boundary.

### Statement Store

- **Statement Store** — A pallet on the People chain that stores small authenticated, expiring payloads. The application
  domain treats it as a generic transport: features (`chat`, `signing-bot-autopair`) submit and read statements without
  knowing chain topology. Exposed via `statementStoreAdapter` and a `lazyClient` that defers People-chain connection until
  first use.
- **SubmitErrorInfo** — Normalized error shape surfaced to features after a submission attempt; `useSubmitError` is the
  React binding.

### Papp provider

- **PAPP** (Polkadot Application) — A third-party host expecting a stable surface from the shell: host metadata, a lazy
  chain client, the statement-store, and per-product localStorage. `usePappProvider` mounts that surface for the
  consuming feature.
- **Legacy SSO migration** — `migrateLegacySsoSessions` walks pre-Papp persisted SSO blobs forward into the current shape.
  One-shot, runs at boot.

### Web3 Summit gate

- **Web3 Summit gate** — A boot-time switch driven by the `w3s_gate_mode` Remote Config parameter that governs how the
  app behaves during/after the Web3 Summit. `web3SummitGateService` is a pure interpreter of an already-read
  `Web3SummitGateMode`; reading the parameter (and applying the default) happens at the composition root (`bootstrap.ts`).
- **Web3SummitGateMode** — The mode union: `VERIFICATION_DISABLED`, `VERIFICATION_ENABLED` (default when absent/invalid),
  `VERIFICATION_ENABLED_SKIPPABLE`, `W3S_ENDED`. `isW3sEnded` is the only consumed predicate today — when the mode is
  `W3S_ENDED` the app renders the ended screen instead of booting.

### Dashboard layout

- **DashboardLayout** — Persistent record describing what cards (products, folders) appear on the home dashboard, their
  positions, and per-widget sizes. Backed by Dexie (`dashboardLayoutDb`).
- **DashboardCard** / **FolderCardPayload** — The card-payload union the layout stores. Folders are first-class cards that
  contain child positions (`FolderItemPositions`).
- **Widget size** — A `(width, height)` pair from the constrained grid (`MAX_WIDGET_WIDTH`, `MAX_GRID_ROWS`,
  `ALLOWED_WIDGET_HEIGHTS`). Variants like `WidgetSizeIconVariant` drive icon-only fallbacks at small sizes.
- **Widget size hints** (`WidgetSizeHints`) — the set of sizes a widget declares it supports, as `{ height, width? }`.
  `dashboardLayoutService.sizeHintsToVariants` / `sizeHintsToLayoutRules` interpret these into this domain's variants and
  resize bounds. This is the dashboard's own input contract — the product manifest happens to produce a compatible shape, but
  the `manifest` concept itself stays in `@/domains/product`; features bridge the two.
- **Cards / folders use cases** — Cross-source flows in `$usecase/cards.ts` and `$usecase/folders.ts` (add, resize,
  remove, favorite, reposition) — they compose the layout repository and the dashboard-layout service.

## Scope

This domain owns:

- The environment registry, its persisted active id, and the one-time legacy `endpointMode` migration.
- The command bus (`commandsService`) and the `Command` shape.
- The Statement Store transport (`statementStoreAdapter`, `lazyClient`) and the submission-error surface.
- The Papp host provider and its legacy-state migrations.
- The Web3 Summit gate: the `w3s_gate_mode` interpretation and its default policy.
- The dashboard layout: schema, persistence, layout service, and the use cases that mutate it.

## Boundaries

This domain does **not** own:

- **Environment switching as a user action.** Reading the active id is here; writing it (with the hard-reload side
  effect) is the `network-settings` aggregate and the onboarding/settings UI.
- **Network connectivity.** Chains, typed clients, and RPC are `@/domains/network`. This domain consumes lazily-built
  clients, never connects directly.
- **The product entity.** Names, icons, manifests, archives, sandbox lifecycle — all in `@/domains/product`. The
  dashboard stores references to products; it does not define them.
- **UI.** Dashboard chrome, drag-and-drop interactions, the Papp container shell, and command-driven modals are features
  and widgets. This domain emits the data they render and accepts the mutations they dispatch.

## References

- [`environment/README.md`](./environment/README.md) — Per-environment endpoints and the active-id selection model.
- [`@/domains/network`](../network/README.md) — Where chain clients (consumed lazily by the statement-store and Papp
  surfaces) actually live.
- [project-structure.md](../../../docs/code/project-structure.md) — Layer model and the domain file-contract rules this
  domain follows.
