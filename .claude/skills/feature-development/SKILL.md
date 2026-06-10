---
name: feature-development
description: Use when working in `src/features/` or `src/routes/` files hosting features, scaffolding a feature, wiring into `src/bootstrap.ts`, defining/injecting DI extension points (slots, pipelines, transformers, side effects, SDKs), placing cross-feature logic, or deciding whether two flows are one feature.
---

# Feature Development

**Precondition:** if you have not yet decided that the change is a feature change, run the `code-placement` skill first. This skill assumes the target layer is already `src/features/` (or a route hosting one).

Then read `docs/code/feature-development.md` before touching feature code. It is the authoritative flow for `src/features/`: principle, step-by-step path including registration in `src/bootstrap.ts`, file contracts, cross-feature sharing rules, the vocabulary + event-storming tests for splitting, and the merge checklist.

The skill body intentionally carries no rules — they live in the doc only, to keep one source of truth. Open the doc.

Cross-references:
- `docs/code/project-structure.md` (Feature section) — folder/file rules.
- `docs/code/code-placement.md` — which layer/file + cut rules, when placement is uncertain.
- `docs/code/architecture.md` — how features consume domain/aggregate surfaces at runtime.
- `docs/code/di.md` — DI extension points and React integration.
