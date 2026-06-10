# Reviewer: Architecture Checklist

Walk this for any change that touches placement, layering, module structure, or a public surface. Cite the **doc and section** when flagging. Severity:

- **blocking** — breaks a one-way dependency rule or a layer invariant. Not mergeable.
- **major** — clearly violates a documented placement/structure pattern.
- **minor** — naming, structure, or maintenance smell.

Rationale for every rule lives in `project-structure.md`, `code-placement.md`, and `di.md`; this file is the citable index. **It lists only rules ESLint does NOT enforce** — pure import-direction (`domain`→up, `aggregate`→up, `@/shared`→up, deep cross-layer imports bypassing a package's `index.ts`) is caught by `eslint-plugin-boundaries` + CI, so don't re-check it. If a violation isn't covered here but is in those docs, flag it and propose adding it (see `rule-extraction.md`).

---

## Layer boundaries — semantic only (`project-structure.md` § Anti-patterns, § Shared)

Import-direction is ESLint-enforced (see above). These remain because a linter can't see them:

- **blocking** — `@/shared` code referencing a specific entity, a business rule, or app state (§ Shared rules). ESLint allows shared→shared imports; it can't tell that the *content* knows about an entity.
- **blocking** — A `feature` importing from / wiring to another `feature` directly instead of through a DI extension point (slot / pipeline / transformer / side effect). ESLint's boundary config currently *permits* feature→feature; the project rule forbids it (anti-pattern 6) — promote the shared piece (DI / widget / aggregate / domain) or merge the features.
- **blocking** — An `aggregate` defining a resource, repository, or persistence schema — backend persistence belongs to a domain (anti-pattern 5). A linter can't tell what a file defines.

## Placement (`code-placement.md`, `project-structure.md` § Where each artifact sits)

- **major** — Business logic that mentions a specific entity (account, chain, product, message, tab) placed in a feature instead of a domain. ("Always check whether the change belongs in a domain before touching a feature.")
- **major** — A piece of code whose *role* crosses two rows of the artifact table — legal imports, wrong home (e.g. a `resource.ts` whose body is really multi-source orchestration that belongs in `$usecase/`, or a mutation composing a use case living in `resource.ts`). (Deep cross-layer imports bypassing `index.ts` are already ESLint-caught.)
- **major** — Single-feature transient state (wizard step, draft, dropdown) placed in an aggregate instead of `features/{feature}/state/`.
- **minor** — An "aggregate" whose only public surface is a `Subject` / `RxEvent` — not an aggregate; use `createSideEffect` or keep it feature-local.

## Domain module structure (`project-structure.md` § Module recursion, § File contracts)

- **major** — A non-canonical file under a domain module (anything other than `index`/`types`/`service`/`resource`/`hooks`/`gateway`/`repository`/`schemas`/`constants`/`bootstrap`/`README`, plus `$usecase/` files and co-located tests). *(The PreToolUse hook blocks new ones; flag any that slipped in.)*
- **major** — A leaf module (no sub-modules) carrying its own `index.ts`. Only containers and the domain root have one.
- **major** — `bootstrap.ts` or `$usecase/` placed inside a sub-module instead of the domain root.
- **minor** — A container nested 3+ levels deep — usually signals a domain should be extracted.

## Use cases & resources (`project-structure.md` § Anti-patterns, § $usecase)

- **major** — A single-line passthrough `${name}UseCase` whose only method wraps one resource (anti-pattern 1). Inline at the caller.
- **major** — A `resource.ts` wrapping a **single-source** use case (anti-pattern 2). The carve-out is allowed only over a genuinely multi-source read (see `glossary.md § Multi-source`).

(Trust-boundary validation and invariant-enforcement location are *content* checks — see `code-checklist.md § Trust boundaries & invariants`.)

## DI naming (`di.md` § Naming)

The syntactic naming convention (suffix / format) is ESLint-enforced via `local-rules/enforce-di-naming-convention`. This row is the *semantic* check a linter can't make:

- **minor** — A slot / pipeline / transformer / side effect / SDK named after a provider or the handler currently injected, instead of the place of use / contract it owns. Apply the test: "if every current provider were removed, would the name still describe the extension point?"

---

When you cite a rule, quote `file:line`, state the rule in one line with its `doc § section`, and suggest the concrete fix. Group findings by theme and end with a verdict (blocking / major / minor counts).
