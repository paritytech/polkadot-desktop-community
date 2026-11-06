# Glossary — load-bearing thresholds

These terms recur as thresholds in the development flows and the review checklists. Use these definitions; don't reinterpret. When a rule says "non-trivial" or "peer file", it means exactly what's here.

## Change size

**Non-trivial change** — goes through the full change process: frame, size, placement, an approved design and plan, a plan review, implementation in reviewed batches, a final review and its fixes. At least one of:

- creates a new file or module;
- introduces or extends a **public surface** (a domain/aggregate/feature `index.ts` export — a service, resource, hook, schema, use case, or DI identifier);
- introduces a new abstraction or **seam** (a DI extension point, a new resource, a new use-case group);
- crosses **≥2 layers** (e.g. touches a domain and a feature);
- **relocates** logic between files or layers (promoting out of a feature, splitting a module);
- adds roughly **≥30 lines of business logic** that warrants tests;
- could **break an existing caller** of a public surface;
- **adds a branch or flag to a shared path** — a second behavior braided into code other callers already use (`docs/abstract/simple-vs-easy.md`). Size is not the test here: three lines qualify. This trigger exists because that change is cheap to write, invisible in review, and paid for by every later change to the same path.

**Trivial in-place edit** — the negation, and the _only_ change that may skip that process: a change confined to **one existing file** that adds no new file, no new public surface, no layer crossing, and no new branch or flag on a path other callers share. Examples: fixing a typo, adjusting a constant's value, a localized bugfix inside one function, tightening a copy string. Counter-example: adding a `skipCache` boolean to a helper three call sites already use — one file, no new surface, still non-trivial. If you're unsure whether a change is trivial, it isn't.

**Blast radius** — the set of files, modules and layers that MUST change for a change to be complete, **measured** (find references and the call hierarchy on every symbol and public surface touched), never estimated from the description. Reported as `N files, K modules, M layers`. Large radius is a measurement of _existing_ complecting, not a property of the change itself. Measured before the design; enumerated again in the plan.

**Complecting** (Hickey) — braiding two concerns together so neither can change without touching the other. A change **adds braid** when it puts a second concern in one place (a flag on a shared path, a field on a shared type, a branch others must now know about) or spreads one concern across more places (a parameter threaded through callers that have no use for it). Orthogonal to size: a three-line diff can add braid, a 90-file rename adds none. The cost is never visible in the current diff — it is paid by every later change. See `docs/abstract/simple-vs-easy.md`.

**Frame** — the change stated in **one sentence using one module's vocabulary**. A frame is a statement of the concern, **not an estimate of the cost**. When the measured blast radius contradicts the frame — one module's vocabulary, three modules or layers of artifact — that gap is a finding that stops for the owner.

## Scope

**Public surface** — what a domain / aggregate / feature exposes through its `index.ts`. Everything else is internal and may be refactored freely; changing the public surface is always non-trivial.

**Module** — one domain, aggregate, feature or widget: a folder directly under its layer (`src/domains/product/`, `src/features/chat/`). A module has one vocabulary, which is why a frame is stated in one module's terms. A domain's sub-modules belong to it.

**Layer** — one of: `shared` → `domains` / `aggregates` → `features` / `widgets` / `routes`. The dependency arrow points only left-to-right (read up-the-graph: features may import domains; domains may not import features). See `project-structure.md`.

**Peer file** — a file that mirrors or directly supports a file already in a plan's scope. Editing a peer does **not** require re-approval; it shares the scope of the file it mirrors:

- the co-located `*.spec.ts` / `*.test.tsx` for a touched file;
- the domain/container `index.ts` re-export line for a new public file;
- the `{group}.hooks.ts` sibling for a new `$usecase/{group}.ts` (and vice versa);
- the `schemas.ts` entry for a touched `gateway.ts` boundary;
- the feature's `feature.tsx` wiring for a slot / DI identifier the same change defines.

Anything else touched outside the plan's stated files that is **not** a peer is **scope creep** — stop and confirm with the owner.

## Composition

**Composition** — depending on **≥2 resources**. That is the threshold for `$usecase/`, and the only thing counted: gateways and repositories are a resource's internals, so a read that calls four gateway methods and merges them into one entity is still a single resource, not composition (`code-placement.md § Cut rules`).

**Data access** — obtaining or persisting a value, including retries and fallback chains ("try disk, then the network"). Always a `resource.ts`, whatever its source count. A resource may not read another resource or a use case; a value it may not fetch itself arrives as a **parameter** supplied by the use case that read it.

**Business invariant** vs data access — see below. Composing two resources is a use case because of the second resource, not because a rule is being enforced; enforcing a rule makes it a use case even over one resource. A use case wrapping one resource and enforcing nothing is data access — inline it or expose it as a resource accessor — **unless** it encapsulates that resource for a consumer that cannot use a hook, keeping the resource object off the domain barrel; that surface control is what makes it a use case rather than a passthrough (`code-placement.md § Cut rules`).

## Trust boundary

**Trust boundary** — where data the codebase did not itself produce enters: API/RPC responses, user input, IPC messages, on-chain payloads, persisted blobs being read back. Data crossing a trust boundary MUST be validated through `schemas.ts` (valibot or a SCALE codec). Values the codebase produced and already typed are **not** re-validated (`project-structure.md` § schemas.ts).

**Business invariant** — a rule that must hold for an entity to be valid given current domain state ("a product is on the dashboard at most once", "transfer ≤ spendable balance"). Enforced in exactly **one** use case (the chokepoint), before the write — never re-checked ad hoc in features/hooks/components. Distinct from a `schemas.ts` _shape_ check.
