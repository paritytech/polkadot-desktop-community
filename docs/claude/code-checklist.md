# Reviewer: Code Checklist

Walk this for every file the diff touches. Cite the **doc and section**. Severity:

- **blocking** — runtime correctness, data loss, trust-boundary or signing-path safety.
- **major** — clearly violates a documented code pattern.
- **minor** — naming, comment noise, redundancy.

Severity only orders the work. Every finding is fixed in this branch.

**This checklist lists only rules ESLint does NOT enforce.** The mechanical style / format / import rules — `as`, `interface`, `Array<T>`, `console.log`, `.forEach`/`for..in`, inline type imports, import order, unused vars (`_`-prefix), the `@/` alias, the 25-import cap, arrow-function components, memoized context values, JSX curly-brace presence, i18n string literals — are caught by ESLint + CI. Don't re-raise them; the reviewer is the layer above the linter: semantics, layering, data flow, naming.

---

## Trust boundaries & invariants (`project-structure.md` § schemas.ts, § $usecase)

- **blocking** — Data crossing a trust boundary (API/RPC, IPC, on-chain payload, user input, persisted blob read back) parsed or trusted without a `schemas.ts` valibot/SCALE validation.
- **blocking** — A business invariant (validity given domain state) checked in a feature/hook/component instead of enforced in the owning use case before the write.
- **major** — Re-validating values the codebase itself produced and already typed (schemas apply only at the boundary).
- **major** — A type derived from a schema/codec hand-declared in `types.ts` instead of via `v.InferOutput` / the codec (the schema is the source of truth).

## Data-access layering (`project-structure.md` § Anti-patterns, § File contracts)

These are file-role rules _within_ a package — ESLint's boundaries plugin works at the package level and can't see them.

- **major** — `hooks.ts` importing `repository.ts` or `gateway.ts` directly; persisted/wire data must reach a hook through a `resource.ts` (anti-pattern 7).
- **major** — A `createMutation` / `useMutation` / `useResource` primitive — there is none; writes are plain functions bound via `useAction` (anti-pattern 6).
- **major** — Inline `useRead(resource, {...})` at a feature call site; features call named domain hooks (`useProducts`), the `useRead` indirection lives in the domain's `hooks.ts` (anti-pattern 2).
- **major** — A domain `hooks.ts` doing feature-specific shaping — if it only matters for one feature it belongs in that feature's `hooks/` (anti-pattern 3).
- **major** — Business logic (transformation, derivation) inside a `hooks.ts` instead of a `service.ts` it should call. Same for a **feature**: a pure non-React derivation/formatter placed in a `hooks/` file (or inline in a hook) instead of the feature-root `service.ts` — or, when it's reusable domain logic over entities, a domain `service.ts` (`project-structure.md` § Feature `hooks/` / `service.ts`).
- **major** — `service.ts` performing I/O or importing a resource/repository/gateway — it's stateless sync helpers only.
- **major** — A `createQueryResource` / `createStreamResource` chain with no `.mock(fn)` step (`project-structure.md` § Domain, `resource.ts`). Unit tests enable mocks globally, so an un-mocked resource runs its real request in every spec that reads through it. Fix: add `.mock(fn)` after `.request()` / `.subscribe()`. **Not** a finding when the request performs no external I/O and a comment above the builder says so.
- **minor** — A `.mock(fn)` body importing a fixture module instead of returning an inline literal. Mocks ship in the production bundle, so the fixtures ship with them.
- **minor** — A spec exercising a resource through `read$` / `cache$` rather than the request body and key function exported from `resource.ts` (`style.md` § Files and tests). Driving the resource tests `@/shared/resource`'s caching and lifecycle, which that library already covers, not the domain. Fix: export the request body and assert it directly.
- **minor** — A spec reaching for `vi.mock` on a domain barrel to stub a read that a resource's `instead(fn)` already covers (`style.md` § Files and tests). `instead` is type-checked against the real signature and self-resets; a module mock is neither.

## Feature UI (`project-structure.md` § Feature, `style.md` § React)

- **major** — A stateful component exported from a feature for another feature's slot (exported feature components must stay presentational — anything stateful is a widget or its own feature).

## Hygiene (`style.md`)

- **minor** — `immer`'s `produce` used for a flat object (nested updates only).
- **minor** — A producer with discrete states exposing several narrow boolean callbacks (`onIdle` + `onError` + …) instead of one `onXChange(status)` over a typed union (`style.md` § JS patterns). One callback keeps a single source of truth and surfaces every state the producer owns.

---

When you cite a rule, quote `file:line`, state it in one line with its `doc § section`, and suggest the fix in 1–2 sentences. Group by theme; end with blocking/major/minor counts and a mergeable verdict.
