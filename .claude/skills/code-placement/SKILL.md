---
name: code-placement
description: Use BEFORE `domain-development`/`feature-development` when the target layer (domain, aggregate, feature, widget, shared) is uncertain — multi-layer changes, new abstractions, promoting code out of a feature, or "where should this live?". Skip when the layer is obvious.
---

# Code Placement

Decide layer BEFORE writing code. Wrong layer = expensive to undo because dependents accumulate.

Layer dependency rule (read up-the-graph): `shared` ← `domains` / `aggregates` ← `features` / `widgets` / `routes`. Never the reverse.

## Decision table

| What you have                                                                  | Where it goes                   |
|--------------------------------------------------------------------------------|---------------------------------|
| Persistent, entity-shaped data; stateless rules over an entity                 | `src/domains/{domain}/`         |
| Cross-feature runtime state (active selection, in-progress flow, user context) | `src/aggregates/{aggregate}/`   |
| Single-feature transient state (wizard step, draft, focus, dropdown)           | `src/features/{feature}/state/` |
| One or a few tightly-coupled user flows + their UI                             | `src/features/{feature}/`       |
| State-aware composite UI reused by 3+ features                                 | `src/widgets/{Name}/`           |
| Stateless reusable UI / generic helper / primitive                             | `src/shared/{library}/`         |

## Sharper checks

- Logic mentions a specific entity (account, chain, product, message, tab) → domain.
- Question is "what is currently selected/active/in-progress" → aggregate.
- Component reads/writes app state but is needed by 3+ features → widget.
- Component is purely presentational (props in, JSX out) → `@/shared/components`.
- Two features need to talk → DI, never a direct import. Other feature is host → inject. This feature is host → define the extension point.
- An "aggregate" whose only public surface is a `Subject` / `RxEvent` → not an aggregate. Use `createSideEffect` or keep it inside the feature.

## When the table doesn't answer — run event storming

If you can't pick a row, the model is ambiguous. Don't guess — run event storming with the user, then re-enter the table. Read `docs/abstract/event-storming.md` for the technique, the worked example, and the narrowing questions.

Trigger conditions:

- The actor, trigger, or post-state of the action is unclear.
- Two vocabularies are showing up in one description (e.g. "chain" and "staking", "message" and "catalog").
- You can't describe the user action in a single sentence using one domain's vocabulary.
- A piece of code seems to fit two layers equally well.

What to do with the result:

- New vocabulary cluster appears → it is its own domain. Extract first, depend on it second.
- Events of two flows interlock (shared trigger / command / state) → one feature.
- Events of two flows don't cross → two features. Sharing UI between them goes through DI / widget / aggregate, not a cross-feature import.

## Hard "no"s

- Domain depending on aggregate / feature / widget / route. One-way only.
- Aggregate defining resources, repositories, or persistence schemas — those belong to a domain.
- Feature importing from another feature. Promote the shared piece (DI / widget / aggregate / domain) or merge the features.
- Module under a domain having its own `index.ts`. The domain root `index.ts` is the only entry point.
- Shared code referencing entities, business rules, or app state.

## See also

- Going to `src/domains/` → also see the `domain-development` skill.
- Going to `src/features/` → also see the `feature-development` skill.
- Full decision framework (which layer / which file per layer / cut rules / binding hooks): `docs/code/code-placement.md`.
- Layer definitions and per-file contracts: `docs/code/project-structure.md`.
- How these artifacts interact at runtime: `docs/code/architecture.md`.
