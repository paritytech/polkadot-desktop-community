# product

The `product` domain owns the runtime side of a Polkadot **product**: how a `polkadot://`-style name is resolved to bytes, how
those bytes get on the device, how the product runs in a sandbox, and what it is allowed to do once it runs.

Within this codebase, a _product_ is an application (or set of applications) addressable through a
dotNS (Polkadot on-chain naming) name and shipped as an IPFS bundle. Once resolved, a product can run in a sandbox,
hold its own per-product key, talk to its own per-product storage, and request scoped device or remote permissions.

## Vocabulary

### Resolution

- **dotNS URL** — A parsed, normalized address: `identifier` (a `.dot` name; `.dot.li` aliases collapsed to `.dot`) plus
  `pathname`. Bare hostnames, `polkadot://` URLs, and localhost forms all reduce to this shape.
- **dotNS gateway** — `dotns/gateway.ts`. Stateless dotNS contract reads (`readResolver`, `readOwner`, `readText`,
  `readContentHashAt`) dispatched as `ReviveApi.call` dry-runs against Paseo Asset Hub. The single wire-level boundary this domain
  crosses to reach dotNS.

### Catalog

Discovery of **published apps** from the on-chain dotNS catalog via `@parity/browse-sdk`. The active environment's dotNS chain
genesis is resolved to a network + RPC; listings are exposed as a cached, reactive read for UI surfaces such as the add-widget
modal.

- **AppListing** — A catalog entry for a published app: `manifest` (display name, description, icon), `label` (its dotNS name),
  and modality. Re-exported from `@parity/browse-sdk`. Base name is derived from `label` via `dotNsService.baseNameOf`.
- **Widget listing** — An `AppListing` whose modality is `widget`; the subset surfaced in the add-widget modal
  (`usePublishedWidgetListings`).
- **Listing → preview product** — `browseService.productPreviewFromListing` assembles a lightweight `Product` from a listing's
  manifest, used to preview an app before it is committed from chain.
- **`publishedWidgetListingsResource`** — `browse/resource.ts`. Cached catalog read keyed by environment (`staleAfter: 60 s`,
  `timeout: 30 s`).

### Manifest

A two-level structure lets a product publish multiple executable surfaces from one dotNS base name. The host reads manifests
text-record-by-text-record and assembles them into the canonical `Product`.

- **Base name** — Full dotNS name of the product, e.g. `hackm3.dot`. Holds the root manifest.
- **Root manifest** — JSON in the `manifest` text record on the base name; carries product-wide metadata (`displayName`,
  `description`, `icon` with Bulletin CID). Schema: `RootManifest` in `product/manifest/schemas.ts`.
- **Executable manifest** — JSON in the `executable` text record on a well-known subname (`app.<base>`, `widget.<base>`,
  `worker.<base>`); carries `appVersion` and kind-specific fields. Schema: `ExecutableManifest` in `product/manifest/schemas.ts`.
  Each subname also exposes a `contenthash` record pointing at that executable's IPFS bundle.
- **Product (aggregated)** — Post-resolution struct combining the root manifest, the present subset of executable manifests, and
  optionally the canonical owner address. The canonical `Product` type for the whole renderer.
- **`fetchProductFromChain`** — `$usecase/resolve.ts`. The canonical chain-resolve primitive: namehash the base, read the registry
  resolver, assemble the root + per-executable manifests (or fall back to the legacy contenthash path), return a `Product` or
  `null`. The single multi-source read every other flow composes; exposed on `resolveProductUseCase`, never called raw.
- **`resolveProduct`** — `$usecase/resolve.ts`. The imperative blend read: prefer the committed DB row, else
  `fetchProductFromChain`. **Pure** — it never writes the DB, never distinguishes pinned from unpinned, and never refreshes in the
  background (that is `reconcileUnpinnedProducts`). For non-React callers needing the value once, on demand (e.g. a dashboard icon
  press). Its React twin is `useDisplayedProduct`.
- **`chainResolveResource`** — `product/resource.ts`. A 60 s in-memory cache over `fetchProductFromChain`, keyed by
  `baseNameOf(identifier)`. Holds **only uncommitted** resolutions — a committed product is served from `productsResource` (the
  live DB) and never lands here, so the two caches cannot duplicate or diverge. The documented resource-over-use-case carve-out:
  it adds nothing but caching. Bound to React via the internal `useChainResolvedProduct`, the fallback inside
  `useDisplayedProduct`.
- **`executableArchiveResource`** — `product/manifest/resource.ts`. Per-executable archive read, keyed by `Executable.identifier`
  (the subname). A **thin content-addressed cache** over `loadArchiveUseCase.loadExecutableArchive` (`$usecase/loadArchive.ts`) —
  the documented resource-over-use-case carve-out: the offline-first orchestration spans multiple sources and performs a write, so
  it lives in the use case; the resource adds nothing but the cache. **Offline-first in Electron:** if the frozen archive is
  already on the main-process [offline archive store](#offline-pin) (`archiveStoreGateway.has`), it serves from there — workers
  pull the bytes back via `archiveStoreGateway.get`, while app/widget are served directly by the main process over `polkadot://`
  (the renderer only needs the origin). Otherwise it IPFS-fetches + CAR-unpacks via `archiveGateway.fetchExecutable`
  (`product/manifest/gateway.ts`, over `@/domains/network/ipfs`) and, for unpinned products, warms the main process's in-memory
  cache (`archiveStoreGateway.warm`, app/widget only — workers run in the renderer, so main never serves them). The IPFS fetcher
  (`archiveGateway.fetchExecutable`) is reused by the pin prefetch, which prefers already-cached bytes via
  `peekExecutableArchive`. Consumed via `useExecutableArchive`.

### Reading a product (which hook?)

Two public read hooks plus the imperative use case; pick by whether the caller is rendering something already committed:

- **`usePersistedProductById` / `usePersistedProducts`** — DB only, over `productsResource` (Dexie `liveQuery`). Use on surfaces
  that exist _because_ the product is committed (dashboard tiles, settings list, worker manager, the product widget). No chain
  call. `useIsProductInstalled` and `useIsPinned` are derived from the same resource.
- **`useDisplayedProduct(productId)`** — persisted `??` chain. **The default** for any screen showing a product by id (tabs,
  address bar, dialogs, settings, webview). Renders the committed row when present and falls back to a live chain resolve only for
  an identifier with no row. The chain fallback is the internal `useChainResolvedProduct` over `chainResolveResource` — there is
  no public chain-only hook; callers go through `useDisplayedProduct`.
- **`resolveProductUseCase.resolveProduct(identifier)`** — non-React, imperative, on demand. Same "prefer committed, else chain"
  rule as `useDisplayedProduct`, for code paths outside the render tree.

Rule of thumb: committed surface → persisted; any "show a product by id" view → displayed; non-React one-shot → `resolveProduct`.

### Archive

- **ProductArchive** — A fetched executable bundle: `domain` (the subname — `app.<base>` / `widget.<base>` / `worker.<base>`),
  normalized `origin` (`polkadot://{domain}`), and a `files: ArchiveContent` map from path to `Uint8Array`. The shape
  `polkadot://`-aware code expects to serve from.

### Sandbox

- **Sandbox** — An isolated execution environment for product code, supplied by `@novasamatech/host-worker-sandbox`.
- **ProductWorkerInstance** — The live unit a renderer holds when a product is running: `sandbox`, `container` (host-container
  handle), an outside-in `events` emitter, a `disposed` flag, and a synchronous, idempotent `dispose()`. Created per
  `(productId, contenthash)` — a new archive means a new instance, never a reused one.
- **Binding** — `(instance, deps) => VoidFunction`. A registration of one host-container handler (chat create-room, post-message,
  action subscribe, etc.) with its host-side cleanup. `defaultWorkerBindings` is the bundle wired into every worker.
- **`createProductWorker(...)`** — The factory that builds a `ProductWorkerInstance`: instantiates the sandbox, runs the bindings,
  kicks off `sandbox.run(code)` fire-and-forget. Disposal is synchronous and ordered (events emitter cleared → binding cleanups →
  container.dispose → sandbox.dispose).

The runtime registry of currently-active instances — and the React hooks that own a worker's lifecycle (`useProductWorker`,
`useProductWorkerInstance`) — live in the `aggregates/product-workers` aggregate. Per `project-structure.md`, runtime state
belongs in an aggregate, not in this domain.

### Offline pin

- **Pinned product** — A committed product whose `PersistedProduct.pinned` flag is `true`: "keep running this exact resolved
  version (the contenthashes frozen on the row's `executables`) and never silently replace it with whatever dotNS currently
  resolves to." Pin state lives on the product row itself in the `products` Dexie table — there is no separate pin store. (Earlier
  branches kept a standalone `offline-pins` database; the v3 migration folded it into this flag.)
- **`commitmentUseCase`** — `$usecase/commitment.ts`. Owns commit + pin + unpin: `commitResolvedProduct` /
  `commitProductByIdentifier` (persist unpinned), `pinProduct` (re-resolve chain, then freeze the row as pinned), `unpinProduct`
  (clear the flag). Commit and pin call `invalidateChainResolve(baseName)` — the id just became committed, so its now-redundant
  chain-cache entry is dropped. These writes are **silent**: no DI fan-out. (Earlier `onProductCommitted` / `onProductPinned` /
  `onProductUnpinned` effects fired into zero handlers and were removed; only forgetting has a side effect — see
  [Lifecycle & actions](#lifecycle--actions).) React bindings: `usePinProduct`, `useUnpinProduct`; read the flag via
  `useIsPinned`. Commit has no hook — it runs imperatively through `commitmentUseCase`, driven by install / add-to-dashboard /
  chat-reference / first-run-seed flows.
- **Offline archive store** — the main-process, on-disk cache of pinned products' executable bytes
  (`<userData>/product-archives/<encodeURIComponent(domain)>/<contenthash>/…`, with a `current.json` pointer per domain). It is
  what makes a pinned product load with no network after a restart: the `polkadot://` protocol handler serves from it on an
  in-memory miss. That in-memory cache (main's `archive-memory-cache.ts`) is byte-bounded and, under pressure, evicts only
  disk-backed entries — they re-warm from disk on the next request, so eviction never makes a pinned product unservable, and
  renderer-warmed (unpinned) entries serving a live webview are never dropped. Reached from the renderer only through
  `archiveStoreGateway` (`product/archive-store/gateway.ts`), the typed boundary over `window.App` archive IPC (`hasArchive` /
  `getArchive` / `saveArchive` / `persistArchive` / `deleteArchive` / `listPersistedArchives`) that folds the web no-op; it lives
  outside the unified Dexie DB (binary bytes don't belong in IndexedDB).
- **`offlineCacheUseCase`** — `$usecase/offlineCache.ts`. Owns the offline-cache lifecycle: `prefetchArchives` (persist every
  present executable for a product, best-effort per kind — reuses bytes already cached by an in-session open via
  `peekExecutableArchive` before re-fetching from IPFS), `evictArchives` (drop disk bytes + index rows for a product),
  `reconcilePinnedArchives` (launch-time repair — see [Lifecycle & actions](#lifecycle--actions)), and `sweepOrphanedArchives`
  (launch-time deletion of on-disk archives no longer owned by a pinned product — closes failed or aborted unpin evictions). The
  per-(product, kind) status — `preparing` / `ready` / `failed` — is persisted in the `productExecutableCache` Dexie table
  (`product/executable-cache/`) and read in the UI via `useOfflineCacheStatus`. `archiveStoreGateway.has` (the disk store) is the
  source of truth for "bytes present"; the index is advisory and reconciled to it on launch.

### Permissions

- **Modality** — a user-facing access surface a permission can be granted through: `app` (full-screen
  SPA), `widget` (dashboard widget); future: pocket, chats. Permission statuses are stored and enforced
  per (product, permission, modality). Not to be confused with **executable kind**: `worker` is an
  executable kind but not a modality — worker-originated permission requests are enforced against `app`.
- **Permission** — A `{ payload, status }` record where `payload` describes what is being asked for (a device type or a remote-URL
  pattern) and `status` is `ask`, `granted`, or `denied`.
- **DevicePermissionType** — `Microphone`, `Camera`, `Bluetooth`, or `Location`.
- **Remote permission** — A grant on an HTTP(S) origin + path prefix, with `*` matching one DNS label of a subdomain. Stored as a
  pattern, matched at use.
- **RemotePermissionIpcRequest** — The incoming request shape for "the product wants to access this URL / submit to this chain",
  deduplicated per `(productId, origin, modality)` so concurrent requests share one prompt.
- **Alias permission** — A persisted decision for cross-app identity alias requests, keyed by
  `(requesterProductId, requestedContextId)`. Stored statuses are `granted` or `denied`; missing entry means `ask`.
- **Interacted product** — A product that is committed **or** carries any stored permission decision (a non-empty
  `productPermissions` row or an alias-permission row as requester), regardless of status. Identity is compared on the normalized
  base name (`isSameBaseName`) since permission rows store raw webview identifiers. Exposed by `useInteractedProducts` as a
  discriminated union (`InteractedProduct`): `committed` entries carry the resolved `Product`; `permissionOnly` entries carry just
  the stored raw id, resolved for display via `useDisplayedProduct`.

### Per-product capabilities

- **Product account** — A public key derived from a root account via HDKD with junctions
  `['product', productId, derivationIndex]`. Products act on-chain through this derived key, never the user's root.
- **Product storage** — Per-product, IndexedDB-backed key/value store of `Uint8Array` values, scoped by `productId`.

### Bootstrap

- **`bootstrapProduct(config)`** — `bootstrap.ts`. The domain's host-environment entry point: registers the product-permission IPC
  request handlers (`onDevicePermissionRequest` / `onRemotePermissionRequest`) on the host bridge, composing per-module bootstraps
  (`bootstrapPermissions`). Called once from the app's `bootstrap.ts`, never at import time. Whether an unmatched remote-URL
  request prompts the user is injected via config (`promptForUnmatchedRemoteAccess`), so the domain stays unaware of test
  environments. The IPC carries the requesting **executable** (`app`/`widget`); `bootstrap.ts` maps it to a permission
  **modality** via `permissionsService.modalityForKind` before resolving the decision.

## Lifecycle & actions

The vocabulary above names the pieces; this section is the narrative — what actually happens when a product is read, committed,
pinned, refreshed, or forgotten.

### Two representations of "a product"

|            | `Product`                                                       | `PersistedProduct`                               |
| ---------- | --------------------------------------------------------------- | ------------------------------------------------ |
| Defined in | `product/types.ts`                                              | `product/repository.ts`                          |
| Shape      | `baseName, displayName, description, icon, executables, owner?` | `Product` **+** `pinned, createdAt, updatedAt`   |
| Meaning    | canonical, chain-resolved struct (no persistence/UI concerns)   | a **committed** product as persisted in Dexie    |
| Identity   | `baseName` (dotNS base, e.g. `app.dot`)                         | `baseName` (primary key of the `products` table) |

**Existence of a `PersistedProduct` row IS the commitment.** "Committed" = "installed" = "has a row." There is no separate
`installed` flag — the only fields a record adds over a `Product` are `pinned` and timestamps. `baseNameOf(identifier)` normalizes
any spelling (`Foo.dot`, `foo`) to the canonical base at every boundary (DB key, cache key, chain lookup), so variants collapse to
one entity. On disk the record is a flatter `ProductRow` (`@/shared/database`); `product/repository.ts` is the only place that
knows the row shape (`rowToPersisted` hydrates it on read). Everything else operates on `PersistedProduct` / `Product`.

### Lifecycle states

- **Uncommitted** (no row) → **Committed·Unpinned** — `commit`
- **Committed·Unpinned** → **Committed·Pinned** — `pin`
- **Committed·Pinned** → **Committed·Unpinned** — `unpin`
- **Committed·Unpinned** → itself — `reconcile` (refresh on launch)
- **Committed·Pinned** → itself — `update version` (re-pin to fresh chain state)
- **Committed·Unpinned** / **Committed·Pinned** → **Uncommitted** — `forget`

| State              | Row? | `pinned` | Metadata freshness                           | Executable version         | Offline                  | Version-check |
| ------------------ | ---- | -------- | -------------------------------------------- | -------------------------- | ------------------------ | ------------- |
| Uncommitted        | no   | —        | live from chain (60 s cache)                 | latest on chain            | no                       | n/a           |
| Committed·Unpinned | yes  | `false`  | commit-time snapshot, refreshed by reconcile | latest at last resolve     | opportunistic            | no            |
| Committed·Pinned   | yes  | `true`   | frozen at pin time                           | **frozen** (contenthashes) | yes (prefetched to disk) | yes           |
| Forgotten          | no   | —        | —                                            | —                          | —                        | —             |

### Write paths

All writes go through `productDb` and are owned by use cases. Every write makes `productsResource` re-emit (Dexie `liveQuery`), so
the persisted/displayed surfaces refresh with no manual cache poke.

- **Commit** (`commitmentUseCase`, Uncommitted → Committed·Unpinned). Two entry points: `commitResolvedProduct(product)` when the
  caller already has a `Product`, `commitProductByIdentifier(id)` when it has only a dotNS id (resolves from chain first). Both
  are **idempotent** — an existing row always wins and is returned unchanged; commit never overwrites or re-pins. On a fresh
  write: `upsert · pinned:false`, then `invalidateChainResolve(baseName)`. Triggered by install / add-to-dashboard
  (`addProductToDashboard`), chat product references, and the first-run seed
  (`ensureDefaultDashboard → commitProductByIdentifier`).
- **Pin / Update Version** (`pinProduct`, → Committed·Pinned). **Always** re-resolves the current chain version first, then writes
  `upsert · pinned:true`, freezing the resolved contenthashes onto the row, and invalidates the chain cache. Backs both "Enable
  offline access" (first pin) and "Update Version" (re-pin to fresh chain state). Pinning is **optimistic**: the row is marked
  pinned immediately, then `offlineCacheUseCase.prefetchArchives` runs fire-and-forget — for each present executable it downloads
  the archive from IPFS and persists it to the [offline archive store](#offline-pin) (`archiveStoreGateway.persist`), tracking
  per-kind status (`preparing` → `ready` / `failed`) in `productExecutableCache`. A failed/partial prefetch is **never** retried
  against the stale contenthash; it is re-pinned in full on next launch (see **Reconcile pinned archives** below), so the row's
  frozen contenthash and the persisted bytes always move together.
- **Unpin** (`unpinProduct`, → Committed·Unpinned). Flips `pinned:false` on an already-committed row (no chain-cache entry to
  evict — the row stays committed), then `offlineCacheUseCase.evictArchives` deletes the persisted disk archives (per-kind subname
  plus the legacy bare-name app archive) and the `productExecutableCache` index rows.
- **Forget** (`productManagementUseCase.forgetProduct`, an **aggregate** use case, → Uncommitted). Detaches from the dashboard
  (`removeIconFromFolder` else `removeCardFromLayout`), then delegates the product-internal teardown to
  `lifecycleUseCase.purgeProduct`: evict the executable-archive caches, then `Promise.all`(delete permissions, `productDb.delete`,
  evict persisted offline archives via `offlineCacheUseCase.evictArchives`, best-effort local-storage wipe), clear the Electron
  sandbox (which also drops the on-disk archives), and — only on a successful delete — fire `onProductForgottenSideEffect`.
  Dashboard detachment lives in the aggregate because it is cross-domain; the domain owns only the purge.
- **Reconcile** (`reconcileUnpinnedProducts`). The **explicit, owned** refresh of unpinned metadata, run on a defined trigger (app
  launch), never as a side effect of viewing a product. For each unpinned row it re-resolves from chain and, if `productDiffers`,
  updates the row (liveQuery re-emits → UI refreshes). Pinned rows are frozen and skipped. Best-effort per row; the chain fan-out
  is batched (`RECONCILE_BATCH_SIZE = 4`) so launch doesn't burst the dotNS endpoint. Freshness for unpinned products is therefore
  bounded to "since last launch" — a deliberate trade to cap chain traffic.
- **Reconcile pinned archives** (`offlineCacheUseCase.reconcilePinnedArchives`). The pinned counterpart, also run at launch. For
  each pinned product it asks the disk store (`archiveStoreGateway.has`) whether every present executable's frozen contenthash is
  persisted; on any miss it runs a **full re-pin** — re-resolve from chain, `upsert · pinned:true`, then prefetch+persist — so a
  pin whose background prefetch failed (e.g. the device was offline) becomes available next session. Best-effort per product; the
  disk store is the source of truth and the `productExecutableCache` index is reconciled to it. Note the deliberate trade-off: the
  re-pin re-resolves the **current** chain version, so if a pinned product's frozen bytes become unrecoverable (evicted
  out-of-band), reconcile advances it to the latest version rather than failing — chosen so the executable manifest and the
  archive bytes can never disagree.
- **Sweep orphaned archives** (`offlineCacheUseCase.sweepOrphanedArchives`). Also at launch, after reconcile. Lists the on-disk
  archives (`archiveStoreGateway.list`) and deletes any domain not owned by a currently-pinned product (the keep-set is each
  pinned product's per-kind subnames plus its legacy bare base name — exactly the keys `persist` writes). Closes the gap where a
  failed or aborted unpin eviction leaves persisted bytes with nothing to remove them (`reconcilePinnedArchives` only repairs
  pinned rows, never sweeps unpinned leftovers). Best-effort per domain.

### Caches & invalidation

| Cache                            | Holds                                | Staleness              | Invalidated by                                                 |
| -------------------------------- | ------------------------------------ | ---------------------- | -------------------------------------------------------------- |
| `productsResource`               | all committed `PersistedProduct`s    | live (Dexie liveQuery) | **automatic** on any `products` write                          |
| `chainResolveResource`           | uncommitted chain resolutions        | 60 s                   | `invalidateChainResolve` on commit / pin                       |
| `executableArchiveResource`      | fetched archive bytes (in-memory)    | ∞ (content-addressed)  | `invalidateExecutableArchive` on purge / refresh               |
| `liveContenthashResource`        | current chain contenthash (no fetch) | 30 s                   | time only (drives the "Update Version" check)                  |
| `productExecutableCache` (Dexie) | per-(product,kind) offline status    | live (Dexie liveQuery) | written by `offlineCacheUseCase`; dropped on unpin / forget    |
| offline archive store (disk)     | pinned products' executable bytes    | ∞ (content-addressed)  | `deleteArchive` on unpin / forget; `clearAllArchives` on reset |

The archive cache is content-addressed, so a new deployment (new contenthash) misses old bytes naturally; a pinned product keeps
its **frozen** contenthash → stable offline bytes. The last two rows are the durable offline layer (only pinned products): the
on-disk archive store in the main process holds the bytes, and `productExecutableCache` tracks their fetch status for the UI — the
disk store is authoritative, the index is reconciled to it at launch. Two manual cache ops sit outside the resolution flow and
touch neither the row, the pin state, nor the persisted offline archive: `lifecycleUseCase.refreshProduct(id)` (browser reload —
evicts the in-memory archive caches so the next load re-fetches) and `lifecycleUseCase.clearProductCache(id)` (product-settings
"Clear cache" — wipes sandbox session + product local storage). Neither deletes a pinned product's offline bytes; only unpin /
forget / reset do.

### What `pinned` actually changes

`pinned` never travels through the `Product` struct — it is read only via `useIsPinned` / `usePersistedProductById`, in exactly
two areas: **offline-access** (`PinIndicator`, `OfflineAccessMenuItem`, `OfflineAccessSection`, `useNewerVersionAvailable`, plus
the offline-status read `useOfflineCacheStatus`) and one tab glyph. Concretely, `pinned = true` vs `false`: reconcile skips it
(frozen) instead of re-resolving on launch; the executable version is frozen at pin time instead of following the last resolve;
the executables are proactively downloaded and persisted to the on-disk offline archive store on pin (durable across restarts,
repaired by reconcile) instead of best-effort-on-load; `useNewerVersionAvailable` compares the live worker contenthash against the
frozen one (returning `null` — no check — when unpinned); and the UI offers "Update Version" / "Remove" (and a
preparing/ready/failed offline status) instead of "Enable offline access."

### Invariants

1. **Row existence = commitment = installed.** No separate flag.
2. **One entity per `baseName`** — all keys normalize through `baseNameOf`.
3. **Committed products never enter the chain cache** — read them from `productsResource`; the two caches can't diverge.
4. **Reads never write.** `resolveProduct` and `useDisplayedProduct` are pure; refresh is the explicit
   `reconcileUnpinnedProducts`.
5. **`commit*` is idempotent** — an existing row always wins; commit never overwrites or re-pins.
6. **Pin freezes; unpin thaws.** Pinned rows are excluded from reconcile and keep frozen contenthashes.
7. **Every write re-emits via `liveQuery`** — no manual cache poke to refresh persisted/displayed.
8. **Pin prefetches; row and disk move together.** A pin proactively persists every executable to the on-disk offline store; a
   failed prefetch is repaired by a full re-pin on launch (never a contenthash-only retry), so `row.contenthash` always matches
   the persisted bytes. `archiveStoreGateway.has` is the source of truth; `productExecutableCache` is reconciled to it. Only
   pinned products have on-disk archives; unpin / forget / reset delete them.

## Scope

This domain owns:

- **dotNS resolution** end-to-end: parsing, normalizing, and the manifest-based two-level lookup against Paseo Asset Hub that
  returns an aggregated `Product` struct (root manifest + executable manifests + optional owner).
- **Catalog discovery** (`browse/`) — listing published apps by modality from the dotNS chain selected for the active
  environment, mapping listings to preview `Product`s, and enriching stored products with catalog manifest fields.
- **Per-executable archive fetching** — pulling each kind's IPFS bundle (CAR archive or directory CID) via
  `@/domains/network/ipfs`, parsing it, and shipping the resulting `ProductArchive` to the main process for `polkadot://` serving.
- **Sandbox construction and disposal** — `createProductWorker` factory, handler bindings, host-side event wiring. Lifecycle
  orchestration (which instance is alive, when it is built/torn down) is owned by `aggregates/product-workers`.
- **Permissions broker** — device and remote-URL grants, pattern matching, dedup of in-flight prompts, persistence.
- **Per-product cryptographic identity** via HDKD-derived product accounts.
- **Per-product persistent storage**.
- **Alias-permission persistence** — decisions for cross-app alias access used by product-container account integrations.

**Why one domain, not several.** Some of these areas have self-contained vocabulary — the sandbox runtime (`worker/`), HDKD key
derivation (`account/`), permission brokering (`permissions/`) — and could in principle stand as their own domains. They are kept
here deliberately: every one is **scoped to a single product** — keyed by `productId` and meaningful only in the context of a
resolved product — so they share this domain's core vocabulary rather than standing alone. The dependency graph stays clean (no
module here reaches into another's internals, and the resolution path imports none of them), so the breadth is cohesion, not
entanglement. Split one out only when it grows a vocabulary that outlives "a product" (e.g. key derivation reused beyond products,
or a worker runtime that hosts non-product code).

## Boundaries

This domain does **not** own:

- **Chain interaction.** Connecting to chains, building typed clients, encoding addresses, and reading blocks are owned by
  `@/domains/network`. Product accounts produced here are pure key derivation; submitting an extrinsic requires composing this
  domain's account with `@/domains/network`'s clients in a feature.
- **IPFS transport.** Fetching raw bytes from IPFS gateways and CAR parsing live in `@/domains/network/ipfs`. The manifest
  sub-module of this domain calls those services but does not own them.
- **Dashboard layout.** Where a product sits on the user's dashboard (folders, widget sizes, positions) is owned by
  `@/domains/application/dashboard-layout`. This domain owns the product itself; the dashboard owns its placement.
- **UI.** Permission prompts, loading screens, and webview chrome are features and widgets. This domain emits requests and exposes
  services.
- **Service-worker registration and routing.** This domain coordinates with the SW through events and persisted archives; the SW's
  lifecycle and message dispatch live in the integration layer.
- **Publishing.** Producing CAR archives, pinning to IPFS, and registering names on-chain are out-of-band tooling concerns, not
  renderer code.
- **Environment / network configuration.** The active environment and its dotNS chain genesis come from `@/domains/application`;
  `browse/` only reads them. The browse protocol itself (network selection, genesis recognition, on-chain query surface) lives in
  `@parity/browse-sdk`.

## References

- [Product Manifest Format](https://github.com/paritytech/triangle-js-sdks/blob/rfc/product-manifest/docs/rfcs/0001-product-manifest.md)
  — Schemas, subname convention, text-record keys, and host resolution flow implemented by `manifest/`.
- [EIP-1577 (Content Hash)](https://eips.ethereum.org/EIPS/eip-1577) — Encoding of the `contenthash` field on per-kind subnames.
  Decoded via [`@ensdomains/content-hash`](https://github.com/ensdomains/content-hash).
- [IPFS CAR specification](https://ipld.io/specs/transport/car/) — Format of the executable bundles fetched from IPFS. Parsed via
  `@ipld/car`, `@ipld/dag-pb`, `ipfs-unixfs`.
- [Paseo Asset Hub](https://wiki.polkadot.network/docs/learn-paseo) — The chain the dotNS resolver contract lives on; reached
  through the Revive (EVM-on-Substrate) API.
- [Substrate hierarchical key derivation (HDKD)](https://wiki.polkadot.network/docs/learn-account-advanced#derivation-paths) —
  Derivation scheme behind product accounts.
- [`@novasamatech/host-worker-sandbox`](https://www.npmjs.com/package/@novasamatech/host-worker-sandbox) — Sandbox primitive used
  here.
- [`@parity/browse-sdk`](https://www.npmjs.com/package/@parity/browse-sdk) — `AppListing`, network selection (`selectNetwork`,
  `isKnownGenesis`), and the catalog SDK (`createBrowseSdk`, `listAppsByModality`) used by `browse/`.
