# Deciding where code goes

The full reference behind the `code-placement` skill: which layer, which file within that layer, and how to tell one kind of artifact from another. The skill carries a quick cheat-sheet for the common cases; this doc is the authoritative version.

Layer definitions and per-file contracts live in [project-structure.md](./project-structure.md). The runtime traces that show these artifacts interacting live in [architecture.md](./architecture.md). When the model itself is ambiguous (you can't pick a layer), run event storming — see [docs/abstract/event-storming.md](../abstract/event-storming.md).

Two questions decide every placement.

---

## Which layer?

| If it…                                                 | Goes in               | Depends on                          |
| ------------------------------------------------------ | --------------------- | ----------------------------------- |
| is a generic primitive with no app knowledge           | `@/shared/{library}`  | nothing in app                      |
| is a persistent entity, its business rules, or its I/O | `@/domains/{name}`    | `shared`, other domains             |
| is cross-feature, cross-domain data flow               | `@/aggregates/{name}` | `shared`, domains, other aggregates |
| is one user flow + its UI                              | `@/features/{name}`   | `shared`, domains, aggregates       |
| is cross-feature, cross-domain UI                      | `@/widgets/{name}`    | `shared`, domains, aggregates       |
| is page composition                                    | `@/routes/`           | features, widgets, `shared`         |

Dependencies flow upward only — `domains` and `aggregates` never import from `features`, `widgets`, or `routes`.

**Aggregate ↔ widget**: sibling concepts. Both are cross-feature, cross-domain reusable units. Widget renders; aggregate
orchestrates. Reach for one when the behaviour is reusable across features, regardless of whether it's UI-shaped or data-shaped.

---

## Which file (per layer)?

**Domain** (`domains/{name}/`):

| Code shape                                                   | File                        |
| ------------------------------------------------------------ | --------------------------- |
| stateless helper on a loaded entity                          | `service.ts`                |
| external I/O (RPC/HTTP/IPFS/P2P)                             | `gateway.ts`                |
| persistence (Dexie / localStorage)                           | `repository.ts`             |
| cached or streamed read                                      | `resource.ts`               |
| multi-source orchestration                                   | `$usecase/{group}.ts`       |
| React binding for a resource                                 | `hooks.ts`                  |
| React binding for a use case                                 | `$usecase/{group}.hooks.ts` |
| host-environment wiring (IPC handlers, native subscriptions) | `bootstrap.ts`              |

**Aggregate** (`aggregates/{name}/`):

| Code shape                                         | File                       |
| -------------------------------------------------- | -------------------------- |
| runtime state (incl. localStorage-persisted)       | `state/`                   |
| multi-domain orchestration                         | `<name>UseCase.ts` at root |
| React binding (state selector or use-case binding) | `hooks.ts`                 |

**Feature / Widget / Shared**: see the [Feature](./project-structure.md#feature), [Widgets](./project-structure.md#widgets), and [Shared](./project-structure.md#shared) sections in project-structure.md.

---

## Cut rules

When deciding which kind of artifact a piece of code is, count its sources.

- **Service method** — stateless, operates on already-loaded entities, no I/O.
- **Resource** — single-source cached/streamed read.
- **Use case** — ≥2 sources (resources / repos / gateways / other use cases), or ≥2 side effects, or composes multiple entities
  into a higher-level type.
- **Aggregate** — ≥2 modules outside the aggregate share runtime state, OR cross-domain orchestration is consumed by ≥2 outside
  modules.
- **Widget** — UI reused by ≥3 features, mounts inline at consumer-decided locations.
- **New domain** — independent vocabulary; the old domain may depend on the new, never the reverse.

The [Where each artifact sits](./project-structure.md#where-each-artifact-sits) table in project-structure.md lists what each
artifact may import and who may import it — the dependency-rule counterpart to these cut rules.

---

## Container-root orchestration (the `$usecase/`-is-domain-root-only gap)

Multi-source orchestration belongs in `$usecase/` — but `$usecase/` exists **only at the domain root**, not inside a sub-module
(container). When a container sub-module (e.g. `chat/p2p`) owns heavy, sub-module-specific cross-source orchestration or
process-wide infra, none of the canonical *leaf* file kinds fit it, and lifting it to the domain-root `$usecase/` would pollute the
whole domain with that sub-module's internals.

Resolution — keep it as a **named container-root file** and frame it in the container's `README.md`. This is a deliberate,
documented exemption, not a stray file. It applies only when **all** hold:

- the logic is genuine multi-source orchestration (a lifecycle/factory composing ≥2 sources) or process-wide infra (a registry/budget singleton);
- it is specific to this container, so domain-root `$usecase/` is the wrong home;
- no canonical leaf kind (`service`/`resource`/`gateway`/`repository`) fits without distorting that kind's contract.

The README must name each such file and say why it's exempt. Effect-orchestration that subscribes to resources and drives a
side-effect channel (e.g. firing OS notifications) is the same class. Do **not** invent ad-hoc names (`manager.ts`, `helpers.ts`)
for ordinary logic to dodge a canonical home — this carve-out is for orchestration/infra that legitimately has none.

---

## React-binding hooks

All React bindings use two hooks from `@/shared/hooks`:

- **`useRead(source, options)`** — reads. `source` is a resource or an async/Observable function. Options: `params`,
  `defaultValue`, `map`. With `map` on a resource, projects the cache shape and reacts to cross-component cache updates; with
  `map` on a function, transforms each emission.
- **`useAction(method)`** — writes/commands. `method` is an async function or Observable factory. Returns
  `{ run, pending, status, data, error, reset }`. `run(params)` returns an `Observable<T>` already subscribed internally —
  fire-and-forget callsites trigger the work, observers can subscribe.

Mutations are plain Observable-returning (or async) functions — there is no primitive wrapper.

**Orchestration in hooks** _(narrow carve-out)_ — orchestration normally lives in `$usecase/` (domain) or `<name>UseCase.ts`
(aggregate); the hook just binds via `useRead` / `useAction`. The exception: when one or more inputs to the orchestration are
**React-only primitives** (a hook from another module with no non-React equivalent — e.g. `useApi(chain)` that holds a connection
alive for the consumer's lifetime), the orchestration must happen inside the consuming hook because the use case can't call hooks.
Prefer making the dependency non-React-available (Observable-shaped, with subscription-as-lifetime) so the orchestration can move
to a use case. The carve-out is for true "no non-React API exists" cases, not convenience.
