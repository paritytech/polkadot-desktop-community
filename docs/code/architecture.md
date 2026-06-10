# Runtime data flow

The dynamic companion to [project-structure.md](./project-structure.md). That doc describes what exists and where (the static layout and per-file contracts); this one traces how data actually moves through the layers at runtime, using the product flow as the worked example.

Read it for orientation before the file-contract rules — it grounds the abstract layer descriptions in two concrete actions. For deciding which layer/file a new piece of code belongs in, see [code-placement.md](./code-placement.md).

---

## Read path — "render the user's installed products"

```
route (src/routes/dashboard.tsx)
  └─ feature  src/features/dashboard/ui/Dashboard.tsx
       │  uses domain hook
       ▼
     domain hook  src/domains/product → usePersistedProducts()
       │  thin wrapper around useRead
       ▼
     domain resource  src/domains/product/product/resource.ts → productsResource
       │  stream subscription
       ▼
     domain repository  src/domains/product/product/repository.ts → productDb.subscribeToAll()
       │  streamTable(@/shared/database) → PersistedProduct[]
       ▼
     resource cache (in memory, Dexie liveQuery-backed)
       ▼
     useRead emits { data, pending, error }
       ▼
     Dashboard re-renders. Cross-component cache hits (another mount of usePersistedProducts) read from the same cache.
```

Key invariants visible in this trace:

- The feature never touches `productsResource` directly — it goes through `usePersistedProducts`.
- The resource is the only thing aware of `repository.ts`. Features don't know Dexie exists.
- No aggregate is involved because nothing about _runtime selection_ is being read — only persistent entity data.

---

## Write path — "add a product to the dashboard"

```
feature UI (src/features/dashboard/...)
  │  onClick
  ▼
aggregate hook  aggregates/product-management/hooks.ts → useAddProductToDashboard()
  │  useAction(addProductToDashboard)  →  .run({ product, gridSize })
  ▼
aggregate use case  product-management/productManagementUseCase.ts → addProductToDashboard
  │  composes two domains' public surfaces:
  │   - @/domains/product   commitmentUseCase.commitResolvedProduct   (persist a PersistedProduct row)
  │   - @/domains/application cardsUseCase.addWidgetToLayout
  │                          / foldersUseCase.addIconToFavorites      (place on dashboard)
  ▼
domain use case  product/$usecase/commitment.ts → commitResolvedProduct
  │   - productDb.upsert(product, { pinned: false })   ← own domain (repository)
  │   - invalidateChainResolve(baseName)               ← drop now-redundant chain cache entry
  ▼
Dexie write → productsResource liveQuery re-emits → useRead emits new value → Dashboard re-renders
```

When the identifier still has to be resolved from chain first (e.g. a dashboard icon press via `useOpenProductSurface`), the resolve step composes leaves across sources:

```
resolveProductUseCase.resolveProduct(identifier)   product/$usecase/resolve.ts
  │  prefer the committed row, else fetchProductFromChain:
  │   - dotns/gateway.ts       (readResolver, readText, readContentHashAt)   ← wire I/O
  │   - product/manifest/...   (parse RootManifest / ExecutableManifest)     ← schema-validated
  │   - @/domains/network/ipfs (ipfsRawResource → CAR parse via ipfsService) ← cross-domain consumption
  │  returns an aggregated Product
```

Key invariants visible in this trace:

- The feature never imports a gateway, repository, schema, or another domain's resource. Use cases (domain `$usecase/` and aggregate `*UseCase.ts`) are the cross-source boundary.
- Cross-domain reach (`@/domains/network`, `@/domains/application`) goes through the _other_ domain's public surface (`ipfsRawResource`, `cardsUseCase`) — never deep imports.
- Commit is **silent**: there is no DI side effect on install. DI fan-out is reserved for actions with real cross-feature consequences — e.g. `onProductForgottenSideEffect` fires on forget so `browser` can close tabs and `notifications` can cancel scheduled notifications. When a side effect fires, the write is already finished; it is a notification, not the primary path.
- The aggregate layer is on the _write_ path here because the flow crosses two domains (product + application). It still touches no cross-feature _runtime_ state — `addProductToDashboard` produces persistent data only. Selecting a tab, opening a worker, holding "currently-being-resolved" status — those would touch an aggregate's `state/`.

---

## When the aggregate's `state/` enters

The write path above uses an aggregate purely as a cross-domain orchestration seam (it owns no `state/`). The aggregate's _runtime state_ enters in a different scenario: a product worker is started. That writes runtime state — "which worker is alive, what is its instance handle" — that multiple features (chat, dashboard, address bar) need. That state lives in `aggregates/product-workers/state`, mutated by an aggregate use case, exposed through aggregate hooks. The domain still owns `createProductWorker` (the factory) and disposal; the aggregate owns the _registry of live instances_.
