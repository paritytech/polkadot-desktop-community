# Glossary — load-bearing thresholds

These terms recur as thresholds in the skills, hooks, and checklists. Use these definitions; don't reinterpret. When a rule says "non-trivial" or "peer file", it means exactly what's here.

## Change size

**Non-trivial change** — triggers the full `architecture` flow (placement + a written plan). At least one of:

- creates a new file or module;
- introduces or extends a **public surface** (a domain/aggregate/feature `index.ts` export — a service, resource, hook, schema, use case, or DI identifier);
- introduces a new abstraction or **seam** (a DI extension point, a new resource, a new use-case group);
- crosses **≥2 layers** (e.g. touches a domain and a feature);
- **relocates** logic between files or layers (promoting out of a feature, splitting a module);
- adds roughly **≥30 lines of business logic** that warrants tests;
- could **break an existing caller** of a public surface.

**Trivial in-place edit** — the negation, and the *only* thing that may skip the `architecture` skill: a change confined to **one existing file** that adds no new file, no new public surface, and no layer crossing. Examples: fixing a typo, adjusting a constant's value, a localized bugfix inside one function, tightening a copy string. If you're unsure whether a change is trivial, it isn't — run `architecture`.

## Scope

**Public surface** — what a domain / aggregate / feature exposes through its `index.ts`. Everything else is internal and may be refactored freely; changing the public surface is always non-trivial.

**Layer** — one of: `shared` → `domains` / `aggregates` → `features` / `widgets` / `routes`. The dependency arrow points only left-to-right (read up-the-graph: features may import domains; domains may not import features). See `project-structure.md`.

**Peer file** — a file that mirrors or directly supports a file already in a plan's scope. Editing a peer does **not** require re-approval; it shares the scope of the file it mirrors:

- the co-located `*.spec.ts` / `*.test.tsx` for a touched file;
- the domain/container `index.ts` re-export line for a new public file;
- the `{group}.hooks.ts` sibling for a new `$usecase/{group}.ts` (and vice versa);
- the `schemas.ts` entry for a touched `gateway.ts` boundary;
- the feature's `feature.tsx` wiring for a slot / DI identifier the same change defines.

Anything else touched outside the plan's stated files that is **not** a peer is **scope creep** — stop and confirm with the user.

## Sources

**Multi-source read** — a read that composes **≥2 distinct sources** (e.g. IndexedDB + chain, two gateways, DB + a use case). Only a multi-source read justifies the one carve-out where a `resource.ts` may wrap a use case (caching over genuinely-composed orchestration — `project-structure.md` anti-pattern 2).

**Single-source** — one source. A single-source read does not justify a resource-over-use-case wrapper, nor a use case at all if it's a one-line passthrough (anti-pattern 1) — inline the source.

## Trust boundary

**Trust boundary** — where data the codebase did not itself produce enters: API/RPC responses, user input, IPC messages, on-chain payloads, persisted blobs being read back. Data crossing a trust boundary MUST be validated through `schemas.ts` (valibot or a SCALE codec). Values the codebase produced and already typed are **not** re-validated (`project-structure.md` § schemas.ts).

**Business invariant** — a rule that must hold for an entity to be valid given current domain state ("a product is on the dashboard at most once", "transfer ≤ spendable balance"). Enforced in exactly **one** use case (the chokepoint), before the write — never re-checked ad hoc in features/hooks/components. Distinct from a `schemas.ts` *shape* check.
