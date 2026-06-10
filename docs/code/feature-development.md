# Feature development flow

Features implement user-facing scenarios on top of domains. They own UI, local flow state, and DI integrations — and they change often. This is the path for building a new feature.

## Principle

A feature is a **consumer** of domain logic and aggregate state, not an extension of either. If your scenario can be expressed as calls to existing domain hooks/services and aggregate hooks/actions, you're in the right place. If it can't, extend the domain first ([domain-development.md](./domain-development.md)), then the aggregate, then come back.

Features may be churny — reshaped, split, or thrown away. That's fine as long as domain APIs stay stable underneath.

## Flow

1. **Describe the user flow.** One or two sentences: who does what, from which entry point, to which outcome. If you're juggling two flows, see [When to split a feature](#when-to-split-a-feature) first.

2. **Confirm the domain supports it.** Skim the domain's `index.ts` for the hooks you need. If something's missing, stop and extend the domain — don't paper over it in the feature.

3. **Scaffold the feature.** Run `/create-feature <name>` — it creates `src/features/{name}/` and registers the feature in `src/bootstrap.ts` (covering step 8). For the file layout and per-file contracts, see the [Feature section in project-structure.md](./project-structure.md#feature).

4. **Build UI on domain and aggregate hooks.**
   - Components read via the named `useX` hooks exposed by domain and aggregate `hooks.ts` files.
   - Dispatch through use cases (via their `use<VerbNoun>` hook, or the group object directly when no UI feedback is needed).
   - Domain/aggregate services may be imported directly.
   - Feature code never restates the underlying primitives — no `createQueryResource`, no inline `useRead(resource, {...})`. Call the named hook.
   - All user-visible strings go through `react-intl` — no JSX string literals (see [style.md](./style.md)).

5. **Place state at the right level** (see the [cut rules](./code-placement.md#cut-rules) for the full criteria):
   - **Feature-local** (wizard steps, draft edits, transient selections internal to one feature) → `state/`, kept internal.
   - **Cross-feature, user-context, transient** (active tab, in-progress flow) → an aggregate.
   - **Persistent, entity-shaped** → a domain resource backed by `repository.ts`.

6. **Integrate via DI** ([di.md](./di.md)).
   - **Inject into others** from `feature.tsx` — slots, pipelines, transformers, side effects, SDK contracts owned by other features or `@/widgets`/`@/shared`.
   - **Define your own extension points** when this feature is the host. Put `createSlot` / `createPipeline` / etc. in dedicated files at the feature root (`di.ts`), re-export from `index.ts`. Name them after the place of use, not the current handler.

7. **Expose via a route, if the feature has its own URL.** Add a thin file under `src/routes/` (TanStack file-based) — routing config and entry component only, no screen logic:

   ```tsx
   // src/routes/dashboard.tsx
   import { createFileRoute } from '@tanstack/react-router';
   import { Dashboard } from '@/features/dashboard';

   export const Route = createFileRoute('/dashboard')({ component: Dashboard });
   ```

8. **Register the feature.** If you skipped `/create-feature`, add the feature identifier to `registerFeatures([...])` in `src/bootstrap.ts` — without this, the feature is invisible.

9. **Test what matters.**
   - **`*.spec.ts`** — pure logic in `state/` and `hooks/`.
   - **`*.test.tsx`** (`@testing-library/react`) — branching UI, conditional rendering, accessibility wiring.
   - **E2E** (`e2e/features/`) — flows crossing features or hitting Electron/IPC.

   Skip what the domain already covers (data shapes, business rules, resource caching).

## Checklist before merging

- [ ] Feature name follows `domain/feature`.
- [ ] `index.ts` exports the feature identifier, DI extension points, and intentionally-public components — no events, resources, services, or internal state.
- [ ] Components reach the world only through domain/aggregate hooks, domain use cases (via their hooks or group objects), domain/aggregate services, feature state, or DI.
- [ ] **No imports of another feature's components, hooks, or state.** The one sanctioned cross-feature import is another feature's **DI identifiers** (slots, pipelines, transformers, side effects, SDK contracts) — to `feature.inject(...)` into them. Everything else is shared via DI or promoted to a widget / aggregate / domain (see [Sharing across features](#sharing-across-features)).
- [ ] No JSX string literals — everything user-visible goes through `react-intl`.
- [ ] No Effector in new code.
- [ ] Feature is registered in `src/bootstrap.ts` (`/create-feature` handles this).
- [ ] If the feature has a URL, a route file exists in `src/routes/` with routing config only.
- [ ] New `data-testid` values live in `src/shared/test-ids.ts`.

## Sharing across features

Features must not import each other's components, hooks, or state — direct cross-feature imports collapse the boundary that makes features replaceable. The **exception** is DI identifiers: a contributing feature imports the host feature's slot / pipeline / transformer / side effect / SDK contract (re-exported from the host's `index.ts`) to inject into it. That's the seam working as intended — the identifier is a contract, not an implementation. Pick the option matching what's being shared:

- **UI composed at a host's extension point** → host defines a slot/transformer/SDK and re-exports the identifier from its `index.ts`; contributors import that identifier and `feature.inject(...)`. No component/hook/state imports either way.
- **Stateless UI reused by 3+ features** → `@/shared/components` (stateless) or `@/widgets/{Name}` (state-aware).
- **Cross-feature runtime/user-context state** → an aggregate under `src/aggregates/`.
- **Cross-feature business logic or persisted data** → a domain under `src/domains/`. The triggering surface for imperative actions is the domain's use case (in `$usecase/`), not a service method.

If none fit, the two "features" are probably one feature — merge them.

## When to split a feature

A feature must implement **one or several tightly coupled user flows** — nothing else. "Tightly coupled" is not subjective: it's the conjunction of two checks below. If a feature fails either, it is doing two jobs and must be split — even when each half builds and ships fine on its own.

The previous heuristic ("distinct entry points / distinct outcomes / no shared draft state") was too permissive: two unrelated flows can pass it while sharing nothing meaningful, and the result is features whose name describes one half while half their files describe something else. Use these two tests instead.

### Test 1 — Vocabulary (ubiquitous language)

List the nouns and verbs each flow uses to describe what it does. They must come from the **same vocabulary**: same entities, same actions, same domain language.

Two vocabularies in one feature is a tell — usually visible from the feature name itself, where the name has to bolt one domain onto another to cover both halves. One name cannot honestly cover both. The fix is not to rename the feature into a broader umbrella; broadening the name only hides the split. The fix is to cut.

### Test 2 — Event storming

Write the events each flow produces and consumes, then draw the causal arrows: event → command → state → view. Flows belong in the same feature only if those arrows **cross between them** — an outcome of one flow triggers the other, or both act on the same state. If you can erase one flow's events and the other diagram is still complete, the coupling was illusory — split.

Technique reference: [event-storming.md](../abstract/event-storming.md).

### Decision

Keep flows together only if **both** hold:

- Vocabularies overlap meaningfully (not just at the level of "app" or "user").
- Event diagrams interlock — at least one shared trigger, command, or state transition.

Otherwise split. Small focused features are easier to rewrite, toggle, or hand off; the real cost of bundling shows up later, as features that change for unrelated reasons.
