# Reviewer: Architecture Checklist

Walk this for any change that touches placement, layering, module structure, or a public surface. Cite the **doc and section** when flagging. Severity:

- **blocking** — breaks a one-way dependency rule or a layer invariant. Not mergeable.
- **major** — clearly violates a documented placement/structure pattern.
- **minor** — naming, structure, or maintenance smell.

Severity only orders the work. Every finding is fixed in this branch.

Rationale for every rule lives in `project-structure.md`, `code-placement.md`, and `di.md`; this file is the citable index. **It lists only rules ESLint does NOT enforce** — pure import-direction (`domain`→up, `aggregate`→up, `@/shared`→up, deep cross-layer imports bypassing a package's `index.ts`) is caught by `eslint-plugin-boundaries` + CI, so don't re-check it. If a violation isn't covered here but is in those docs, flag it and propose adding it (see `rule-extraction.md`).

---

## Layer boundaries — semantic only (`project-structure.md` § Anti-patterns, § Shared)

Import-direction is ESLint-enforced (see above). These remain because a linter can't see them:

- **blocking** — `@/shared` code referencing a specific entity, a business rule, or app state (§ Shared rules). ESLint allows shared→shared imports; it can't tell that the _content_ knows about an entity.
- **blocking** — A `feature` importing from / wiring to another `feature` directly instead of through a DI extension point (slot / pipeline / transformer / side effect). ESLint's boundary config currently _permits_ feature→feature; the project rule forbids it (anti-pattern 5) — promote the shared piece (DI / widget / aggregate / domain) or merge the features.
- **blocking** — An `aggregate` defining a resource, repository, or persistence schema — backend persistence belongs to a domain (anti-pattern 4). A linter can't tell what a file defines.

## Placement (`code-placement.md`, `project-structure.md` § Where each artifact sits)

- **major** — Business logic that mentions a specific entity (account, chain, product, message, tab) placed in a feature instead of a domain. ("Always check whether the change belongs in a domain before touching a feature.")
- **major** — A piece of code whose _role_ crosses two rows of the artifact table — legal imports, wrong home (e.g. a mutation composing a use case living in `resource.ts`). (Deep cross-layer imports bypassing `index.ts` are already ESLint-caught.)
- **major** — Single-feature transient state (wizard step, draft, dropdown) placed in an aggregate instead of `features/{feature}/state/`.
- **minor** — An "aggregate" whose only public surface is a `Subject` / `RxEvent` — not an aggregate; use `createSideEffect` or keep it feature-local.
- **major** — UI presentation vocabulary inside a domain (`project-structure.md` § Anti-patterns #8): a domain `service`/`resource`/`types` naming a UI widget (`banner`, `badge`, `toast`), encoding a visibility decision (`null`/absent = "hidden"), or mapping copy/icons. The domain exposes a semantic state; the feature maps it to presentation.

## Domain module structure (`project-structure.md` § Module recursion, § File contracts)

- **major** — A non-canonical file under a domain module (anything other than `index`/`types`/`service`/`resource`/`hooks`/`gateway`/`repository`/`schemas`/`constants`/`bootstrap`/`README`, plus `$usecase/` files and co-located tests). _(New ones are blocked at creation; flag any that slipped in.)_ **Exempt:** a named container-root orchestration/infra primitive that the container `README.md` explicitly frames per `code-placement.md` § Container-root orchestration (the `$usecase/`-is-domain-root-only gap) — don't re-flag a documented one.
- **major** — A leaf module (no sub-modules) carrying its own `index.ts`. Only containers and the domain root have one.
- **major** — `bootstrap.ts` or `$usecase/` placed inside a sub-module instead of the domain root.
- **minor** — A container nested 3+ levels deep — usually signals a domain should be extracted.

## Use cases & resources (`project-structure.md` § Anti-patterns, § $usecase)

- **blocking** — A `resource.ts` reading another resource, or importing/calling a use case (anti-pattern 1) — whether imported directly from `$usecase/` or pulled in through another domain's barrel (`@/domains/x`). There is no "the resource only adds caching" exemption. Fix: whatever it reached for becomes a **parameter**, supplied by the use case (or `$usecase/*.hooks.ts` binding) that read it, so it joins the cache key. Note `local-rules/enforce-import-restrictions` matches the `**/$usecase/*.ts` path only, so barrel-imported use cases pass lint and must be caught here.
- **major** — A `$usecase/` method that composes fewer than 2 resources and enforces no invariant — that is data access, and belongs in `resource.ts` (`code-placement.md § Cut rules`). Gateway calls do not count toward composition: a read hitting four gateways is one resource. Retry/fallback chains ("try disk, then IPFS") are data access, not orchestration. **Exception:** a use case that encapsulates a single resource to give a consumer that cannot use a hook (a non-React caller, e.g. a core-driven generator callback) a named domain entry point, keeping the resource object off the barrel — that surface control is what makes it a use case, not a passthrough (`code-placement.md § Cut rules`). Does not apply to a React consumer, which reads through the resource's `hooks.ts`.
- **major** — A `gateway.ts`, `repository.ts`, `service.ts`, or `schemas.ts` importing a `$usecase/` file or a use case named `*UseCase` (same-domain or another domain's). These leaves are **consumed by** use cases; the reverse inverts the dependency (a low-level wire/persistence/validation/helper artifact depending on a high-level orchestrator). Fix: the thing being reached for is either (a) not really a use case — a stateless primitive over injected inputs belongs in `service.ts` or `@/shared` where any layer may consume it — or (b) the composition belongs one layer up, in the use case that should call this leaf. `resource.ts` is bound by the same rule — it may **never** import a use case (see the row above). ESLint's boundaries plugin can't catch this (every artifact is the same `domains` element); the generic `local-rules/enforce-import-restrictions` rule can enforce it when configured with a per-artifact allow-list for `./src/domains/*`, and this checklist backs it.

(Trust-boundary validation and invariant-enforcement location are _content_ checks — see `code-checklist.md § Trust boundaries & invariants`.)

## Complexity — braid & blast radius (`docs/abstract/simple-vs-easy.md`)

Complecting is invisible to every other row here: it breaks no import rule, lands in a canonical file, and passes lint. It is also the one defect whose cost is paid entirely _after_ merge, which is why review is the last gate that can see it. **Size is not the test** — three lines qualify; a 90-file rename may add none.

- **major** — A new **flag, mode, or branch parameter added to a path other callers already share**, not named in the design or plan. Test before flagging: do two call sites pass different values, and do the two branch bodies share little? Then these are two behaviors braided into one path — the fix is two functions (or two resources), not a parameter. _Not_ a finding when every caller passes the same value today (that is a dead option — flag as minor YAGNI) or when the branch is a genuine runtime condition the callers cannot know.
- **major** — A value **threaded through call sites that only forward it** and never read it. Forwarding is the signature of complecting: those files were changed because the value is braided into the call chain, not because they use it. Fix: supply it at the composition point that owns it — a use-case parameter, a DI identifier, or the resource's cache key (`project-structure.md` § "a parameter the key already subsumes") — so intermediate callers stop carrying it.
- **major** — A **new field on a shared type that most consumers ignore**, or one whose meaning depends on another field's value. Two independent concerns in one type; split the type or model the pair as a discriminated union.
- **minor** — **Diff radius contradicts the stated intent**: the design/plan/PR title frames the change in one module's vocabulary (`glossary.md` § Scope) and the diff spans three or more modules or layers, or reaches public surfaces the frame never mentioned. The gap is not itself a defect — the finding is that it was never surfaced for a decision. Propose staging into reviewable PRs, and check whether the size probe (`docs/abstract/simple-vs-easy.md` § The probe) recorded the radius at all. Never blocking: at review time that cost is already sunk.
- **minor** — A `ponytail:`-style deferral, `TODO`, or "clean this up in a follow-up" comment covering braid the diff introduces is a finding, fixed in this branch. The braid would otherwise ship with the follow-up unfunded.

## DI naming (`di.md` § Naming)

The syntactic naming convention (suffix / format) is ESLint-enforced via `local-rules/enforce-di-naming-convention`. This row is the _semantic_ check a linter can't make:

- **minor** — A slot / pipeline / transformer / side effect / SDK named after a provider or the handler currently injected, instead of the place of use / contract it owns. Apply the test: "if every current provider were removed, would the name still describe the extension point?"

---

When you cite a rule, quote `file:line`, state the rule in one line with its `doc § section`, and suggest the concrete fix. Group findings by theme and end with a verdict (blocking / major / minor counts).
