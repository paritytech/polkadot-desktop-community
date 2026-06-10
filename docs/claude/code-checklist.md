# Reviewer: Code Checklist

Walk this for every file the diff touches. Cite the **doc and section**. Severity:

- **blocking** — runtime correctness, data loss, trust-boundary or signing-path safety.
- **major** — clearly violates a documented code pattern.
- **minor** — naming, comment noise, redundancy.

**This checklist lists only rules ESLint does NOT enforce.** The mechanical style / format / import rules — `as`, `interface`, `Array<T>`, `console.log`, `.forEach`/`for..in`, inline type imports, import order, unused vars (`_`-prefix), the `@/` alias, the 25-import cap, arrow-function components, memoized context values, JSX curly-brace presence, i18n string literals — are caught by ESLint + CI. Don't re-raise them; the reviewer is the layer above the linter: semantics, layering, data flow, naming.

---

## Trust boundaries & invariants (`project-structure.md` § schemas.ts, § $usecase)

- **blocking** — Data crossing a trust boundary (API/RPC, IPC, on-chain payload, user input, persisted blob read back) parsed or trusted without a `schemas.ts` valibot/SCALE validation.
- **blocking** — A business invariant (validity given domain state) checked in a feature/hook/component instead of enforced in the owning use case before the write.
- **major** — Re-validating values the codebase itself produced and already typed (schemas apply only at the boundary).
- **major** — A type derived from a schema/codec hand-declared in `types.ts` instead of via `v.InferOutput` / the codec (the schema is the source of truth).

## Data-access layering (`project-structure.md` § Anti-patterns, § File contracts)

These are file-role rules *within* a package — ESLint's boundaries plugin works at the package level and can't see them.

- **major** — `hooks.ts` importing `repository.ts` or `gateway.ts` directly; persisted/wire data must reach a hook through a `resource.ts` (anti-pattern 8).
- **major** — A `createMutation` / `useMutation` / `useResource` primitive — there is none; writes are plain functions bound via `useAction` (anti-pattern 7).
- **major** — Inline `useRead(resource, {...})` at a feature call site; features call named domain hooks (`useProducts`), the `useRead` indirection lives in the domain's `hooks.ts` (anti-pattern 3).
- **major** — A domain `hooks.ts` doing feature-specific shaping — if it only matters for one feature it belongs in that feature's `hooks/` (anti-pattern 4).
- **major** — Business logic (transformation, derivation) inside a `hooks.ts` instead of a `service.ts` it should call.
- **major** — `service.ts` performing I/O or importing a resource/repository/gateway — it's stateless sync helpers only.

## Feature UI (`project-structure.md` § Feature, `style.md` § React)

- **major** — A stateful component exported from a feature for another feature's slot (exported feature components must stay presentational — anything stateful is a widget or its own feature).

## Hygiene (`style.md`)

- **minor** — `immer`'s `produce` used for a flat object (nested updates only).

---

When you cite a rule, quote `file:line`, state it in one line with its `doc § section`, and suggest the fix in 1–2 sentences. Group by theme; end with blocking/major/minor counts and a mergeable verdict.
