---
name: domain-development
description: Use when working in `src/domains/`, introducing/extending a domain's public API (services, resources, hooks, repositories, schemas, README), modeling a user action in domain terms, event-storming domain seams, or deciding whether business logic belongs in a domain.
---

# Domain Development

**Precondition:** if you have not yet decided that the change is a domain change, run the `code-placement` skill first. This skill assumes the target layer is already `src/domains/`.

Then read `docs/code/domain-development.md` before touching domain code. It is the authoritative flow for `src/domains/`: principle, step-by-step path, file contracts, merge checklist, and event-storming guidance for spotting domain seams.

The skill body intentionally carries no rules — they live in the doc only, to keep one source of truth. Open the doc.

Cross-references:
- `docs/code/project-structure.md` (Domain section) — folder/file rules.
- `docs/code/code-placement.md` — which layer/file + cut rules, when placement is uncertain.
- `docs/code/architecture.md` — how domain artifacts flow at runtime (read/write traces).
- `docs/code/di.md` — when DI wiring is involved.
