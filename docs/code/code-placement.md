# Deciding where code goes

Which layer, which file within that layer, and how to tell one kind of artifact from another.

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
| any data access — cached/streamed read or write              | `resource.ts`               |
| composition over ≥2 resources, or invariant enforcement      | `$usecase/{group}.ts`       |
| React binding for a resource                                 | `hooks.ts`                  |
| React binding for a use case                                 | `$usecase/{group}.hooks.ts` |
| host-environment wiring (IPC handlers, native subscriptions) | `bootstrap.ts`              |

> **A domain has no runtime state.** There is deliberately no `state/` row above. A module-level `Subject` / `BehaviorSubject` /
> `createState` / `createEvent` living in a domain — anything other than a localStorage-backed `repository.ts` using
> `persistLocalStorage` — is an aggregate smell. Move real cross-cutting runtime state (selections, in-flight flags, live
> connection phase) to an aggregate's `state/`. If the thing carries no state — a fire-and-forget cross-module signal channel —
> model it as a `createSideEffect` (DI) instead, not a shared module-level subject.

**Aggregate** (`aggregates/{name}/`):

| Code shape                                         | File                       |
| -------------------------------------------------- | -------------------------- |
| runtime state (incl. localStorage-persisted)       | `state/`                   |
| multi-domain orchestration                         | `<name>UseCase.ts` at root |
| React binding (state selector or use-case binding) | `hooks.ts`                 |

**Feature / Widget / Shared**: see the [Feature](./project-structure.md#feature), [Widgets](./project-structure.md#widgets), and [Shared](./project-structure.md#shared) sections in project-structure.md.

---

## Cut rules

**Resources are the data layer; use cases are composition over it.** Two questions decide every artifact: what kind of work it
does, and who else needs it.

### What kind of work

- **Service method** — a pure derivation over already-loaded entities. No I/O.
- **Resource** — one cached or streamed read, or one write. Its sources are leaves (`gateway.ts`, `repository.ts`); everything
  else it needs arrives as a **parameter**. It never reads another resource and never calls a use case.
- **Use case** — composition. Composes ≥2 **resources**, enforces a business invariant, fans out ≥2 side effects, or
  **encapsulates a single resource** to give a consumer that cannot use a hook (a non-React caller — e.g. a core-driven
  generator callback) a named domain entry point, keeping the resource object off the public surface.

A resource may call four gateway methods and merge the results into one domain entity — gateways are its internals, not
composition. **Composition begins at the second _resource_.**

Encapsulation is the one reason a single-resource use case is not a passthrough: what it adds is surface control, keeping the
resource's `invalidate` / `instead` / `cache$` off the domain barrel while still exposing the read. It applies only when the
consumer cannot use a hook — a React consumer reads through the resource's `hooks.ts`, so wrapping the resource for it adds
nothing and is a passthrough. A resource-level accessor function (the `readTheme` shape) is the equally valid alternative; pick
one, not both.

Direction: use cases depend on resources, never the reverse.

**A use case may also call a gateway or repository directly.** Leaves are open to both layers — a resource reaches them to build
a cache, a use case reaches them for work that needs none (a one-off write, a fire-and-forget wire call). Doing so is not a
missing resource: a resource exists to give a read an identity and a cache, so work that wants neither has no resource to skip.
What a use case may **not** do is reach a leaf to reproduce a read a resource already owns — that duplicates the source and
leaves the cache serving a value nobody refreshes.

> **Why count resources and not gateways.** A gateway is one wire call with no cache and no identity; a resource is a cache with
> a key. Counting gateways promotes ordinary fetches into orchestration, which then cannot be cached without inverting the
> dependency — the knot that produced every "resource wrapping a use case" exemption this codebase used to carry. Counting
> resources measures the thing that actually matters: how many independently-invalidating caches a piece of code depends on.

### Who else needs it

- **Aggregate** — ≥2 modules outside the aggregate share runtime state, OR cross-domain orchestration is consumed by ≥2 outside
  modules.
- **Widget** — UI reused by ≥3 features, mounts inline at consumer-decided locations.
- **New domain** — independent vocabulary; the old domain may depend on the new, never the reverse.

The [Where each artifact sits](./project-structure.md#where-each-artifact-sits) table in project-structure.md lists what each
artifact may import and who may import it — the dependency-rule counterpart to these cut rules.

---

## Container-root orchestration (the `$usecase/`-is-domain-root-only gap)

Composition belongs in `$usecase/` — but `$usecase/` exists **only at the domain root**, not inside a sub-module
(container). When a container sub-module (e.g. `chat/p2p`) owns heavy, sub-module-specific composition or
process-wide infra, none of the canonical _leaf_ file kinds fit it, and lifting it to the domain-root `$usecase/` would pollute the
whole domain with that sub-module's internals.

Resolution — keep it as a **named container-root file** and frame it in the container's `README.md`. This is a deliberate,
documented exemption, not a stray file. It applies only when **all** hold:

- the logic is genuine composition (a lifecycle/factory composing ≥2 resources) or process-wide infra (a registry/budget singleton);
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
