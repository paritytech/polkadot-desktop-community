# Architecture Review Framework for a Complex Client-Side Project

A repeatable way to review a large UI codebase that has grown tangled — high coupling, business rules scattered across components, a domain that's hard to point at. It's written for an engineer running the review (alone or with the team) and produces a short list of prioritized findings, each tied to a concrete next step and a check that stops it from regressing.

You don't read this top to bottom every time. Read sections 1–4 (the model, the concepts, the inputs, the procedure) once to understand it; then use sections 5+ as the working checklist.

---

## 1. The idea in one paragraph

A complex UI fails for two related reasons: **coupling that nobody decided on** (changing one thing breaks five) and **a domain model that was never made explicit** (business rules dissolve into the view). This review does three things about that: it locates where boundaries are missing, makes the trade-offs behind the current design explicit instead of accidental, and converts each problem into an automated check so the conclusion stays true after you've moved on. Everything below is an instance of that loop: *find a boundary that should exist → decide the least-worst way to introduce it → lock it in with a check.*

---

## 2. Three concepts this document keeps using

Define these once; the rest of the document assumes them.

**Coupling** — how much one part of the system must know about another in order to work. Some coupling is unavoidable; the problem is coupling that forms without anyone choosing it. Two kinds matter:
- *Static coupling*: what imports what. Visible in the dependency graph. Too much makes the code rigid.
- *Dynamic coupling*: what talks to what at runtime — shared stores, event buses, context providers, prop chains. Too much makes behavior unpredictable.

**Boundary** — an explicit seam across which two parts agree on a contract and otherwise stay ignorant of each other. A *bounded context* is a boundary in the domain (e.g. signing vs balances each have their own model). An *anti-corruption layer (ACL)* is a boundary against an external system: a translation layer so an outside API's shapes don't leak inward. Boundaries are the main tool for controlling coupling.

**Trade-off & fitness function** — a *trade-off* is the quality you gave up to get the one you wanted (speed now vs evolvability later). A *fitness function* is an automated check that fails when an architectural property you care about is violated — the mechanism that keeps a boundary or rule enforced over time instead of relying on memory and discipline.

---

## 3. Before you start: inputs to gather

The review is only applicable if you have the project in front of you in these forms:

- **The dependency/import graph** — some way to see what imports what across modules, including cycles. This is your static-coupling map.
- **A change-frequency heatmap** — which files/modules churn most (commits touching each path over the last several months). This tells you where coupling actually hurts.
- **The domain glossary** — the words product people and domain experts use, and whether the code uses the same ones.
- **The external integration points** — every API, SDK, host interface, and chain boundary the UI touches.
- **The current module structure and ownership** — folders, layers, and who (if anyone) owns each area.

If you can't produce the first two maps, build them first; the rest of the review leans on them.

---

## 4. How to run the review

1. **Set priorities first (≈30 min, with the team).** Before judging anything, name the project's top architectural qualities and rank them (section 8). For a wallet/signing UI that's usually correctness, security, auditability, predictability — above raw performance. You can't call something a problem until you know what the system is optimizing for.
2. **Overlay the two maps.** Put the dependency graph next to the churn heatmap. The modules that are both heavily coupled and frequently changed are where you start — that's where coupling taxes you daily.
3. **Walk dimensions 5–7 against the hot modules first.** Use the probes and red flags. Don't try to cover the whole codebase; cover the part that's costing you.
4. **Record each finding** with the template (section 9). For every finding, decide the least-worst *incremental* step and the fitness function that would lock it in (dimension 9 / section 9).
5. **Check boundaries and ownership (dimension 10).** This is a whole-project pass, not per-module.
6. **Prioritize and write up** (section 11). The output is a short document of findings, not an annotated tour of the codebase.

---

## 5. Dimension — Domain model and the UI ↔ domain boundary

**What this is.** In a UI, business rules tend to dissolve into components: a validation here, a derived value there, a branch in a render path. The domain stops being a thing you can point at and becomes an emergent property of the whole app. This dimension checks whether the domain is a distinct, nameable layer with explicit boundaries. The harder your domain, the more this matters — scattered rules are the single biggest driver of "change one thing, break five."

**Vocabulary in play:** ubiquitous language (one concept, one name everywhere), bounded context, aggregate + invariants (rules enforced in one place), anti-corruption layer.

**Probes:**
- Can you point to a layer/folder where domain logic lives without depending on React/DOM/the runtime shell? If not, the domain is nailed to the UI.
- Is the same concept named consistently everywhere? (Classic offenders: `account` / `address` / `wallet` / `signatory`; `tx` / `extrinsic` / `call`.)
- Can you enumerate the bounded contexts (e.g. signing, balances, governance, staking, fees), or is there one giant `AppState` that knows about everything?
- Where are domain invariants enforced — in one place, or re-checked ad hoc inside handlers?
- At the boundary with external APIs (chain metadata, the host API, the chain library), is there an ACL — or do raw library types crawl all the way into components?

**Red flags:**
- Domain types import the UI framework or a transport library.
- "Smart" components mixing rendering, domain rules, and network calls.
- Raw external structures (RPC responses, codecs, metadata) appearing in props and UI state.
- One glossary in design / with product, a different one in code.

**Fitness functions:**
- The domain layer may not import the UI framework, the runtime shell, the UI kit, or transport — enforced as an import-boundary rule.
- External SDK types may be referenced only inside the adapter/ACL layer.
- A living glossary plus a check on banned synonyms.

---

## 6. Dimension — Coupling and modularity

**What this is.** This is usually the loudest symptom in a "high coupling" project, so it's where measurement pays off most. You're looking at both the static graph (imports) and the dynamic graph (runtime communication), and asking which dependencies exist by decision versus by accident.

**Probes (static):**
- Are there cycles in the module graph?
- Is there a "god module" — a `utils` / `common` / `shared/types` that almost everything depends on? That's the worst kind of incoming (afferent) coupling.
- Standard metrics compute directly on the TS graph: afferent (Ca) and efferent (Ce) coupling, instability `I = Ce / (Ca + Ce)`, distance from the main sequence. Modules with high Ca and high instability are the priority to stabilize.

**Probes (dynamic):**
- Global stores everyone reads and writes; context providers wrapped around the whole tree; event buses; prop drilling through many levels.
- When you change one piece, how many others must know immediately (synchronous coupling) vs can find out later (asynchronous)?
- The smallest replaceable slice: what can you delete or swap without touching the rest? For you the natural candidate is a widget (given the host API) or a feature slice.

**A sharper code-level vocabulary** than static/dynamic: connascence — of name, type, meaning, position, execution order. Useful for naming *why* two places are coupled and how painful the change would be.

**Red flags:**
- A change in one module reliably breaks 5+ places unrelated in meaning.
- State mutated from many places with no single owner.
- "Magic" strings/indices/call ordering acting as an implicit contract.

**Fitness functions:**
- CI fails on import cycles.
- Layers/contexts encoded as import rules: who may depend on whom.
- A coupling budget: alert when a module's efferent coupling crosses a threshold.
- Dead-export detection, to shrink the coupling surface.

---

## 7. Dimension — State and data

**What this is.** A complex UI is a small distributed data system: server data, local data, and views derived from both, all trying to stay consistent. Most bugs in such apps aren't logic errors — they're *consistency* errors, where two copies of the same fact drift apart. This dimension finds, for each fact, where the single source of truth is and whether everything else is computed from it or hand-synchronized. Given your Dexie/IndexedDB and reactivity work, this is especially live.

**Probes:**
- For each piece of state: source of truth or derived? Is derived data computed (selectors / memoization / live queries) or is a cache kept in sync by hand (the prime desync source)?
- Are server-state and client-state (UI flags, drafts) separated, and what's the consistency model between them?
- Optimistic updates: is there a rollback and conflict-resolution strategy?
- Offline / local-first: idempotency, retries, eventual consistency at the UI layer.
- Change propagation: how does reactivity carry an update, and do you get cascading re-renders (a "UI scalability" problem)?

**Red flags:**
- The same entity living in three places (store, query cache, component-local) and "synchronized" manually.
- Derived data stored rather than computed.
- State collapsed into a single boolean `isLoading`, with no "stale / error / empty".

**Fitness functions:**
- An architectural test asserting one source of truth per entity (banning duplicate stores).
- Contract tests on the external→domain mapping.
- A render-performance budget on key screens, measured on heavy scenarios in CI.

---

## 8. Dimension — Architectural characteristics and trade-offs

**What this is.** Every architecture optimizes for some qualities at the expense of others. The failure mode isn't choosing wrong — it's never choosing, so the optimization happens by accident. This dimension checks whether the priority qualities are named, and whether shaping decisions were recorded with the trade-off they made. (Run this *first* in practice — step 1 of the procedure — because the priorities decide what counts as a problem elsewhere.)

**Probes:**
- Are the driving qualities named and ranked, and is that written down or living in heads?
- Are there ADRs (architecture decision records) for non-obvious decisions, with the alternatives and what was sacrificed?
- At key forks, can you state "if we swap A for B, which quality improves and which degrades"?

**Red flags:**
- "We did it this way because we're used to it," with no recorded reason.
- Optimizing for a quality that isn't a priority (micro-optimizing rendering at the expense of signing correctness).

**Fitness functions:**
- An ADR log in the repo; an ADR required for changes that cross context boundaries.
- A qualities checklist in the PR template for architecturally significant changes.

---

## 9. Dimension — Evolvability and fitness functions

**What this is.** A review is a snapshot; architecture decays continuously. This dimension is less "what's wrong now" and more "which of our rules are enforced by a machine versus held together by discipline." Everything you flag in dimensions 5–8 should ideally graduate into a check here. An evolutionary architecture rests on three things: incremental change, fitness functions, and appropriate coupling.

**A catalog of fitness functions to assemble (TS/frontend):**
- Domain-layer purity (domain must not import UI/transport).
- Context boundaries as import rules.
- Zero import cycles.
- Complexity budgets: function complexity, file/module size.
- A per-route bundle-size budget, as a "complexity isn't growing unnoticed" signal.
- Type-level invariants as compile-time checks: branded types for domain ids (can't pass an `Address` where an `AccountId` is expected), exhaustive `switch` over domain unions, a minimum typed-code coverage threshold.
- Contract tests on the ACL.

**Probes:**
- Can a typical domain change be made in small steps, or does it fan out across the whole tree?
- How many architectural rules currently rest on code review (discipline) instead of CI?

**Red flags:**
- Architectural agreements that are entirely verbal.
- Complexity and coupling growing with nothing measuring it.

---

## 10. Dimension — Cognitive load and boundaries

**What this is.** Code structure and team structure shape each other (Conway's Law). The practical metric is cognitive load: how much someone must hold in their head to safely change an area. When boundaries don't match how people actually work, every change spills across them. This is a whole-project pass.

**Probes:**
- Do module boundaries match how people reason and work? Does the code structure mirror the team structure deliberately or by accident?
- Is there an area too large to hold in one head?
- Is the internal UI Kit / SDK a "thinnest viable platform" offered to feature teams, or a dumping ground everything flows into?

**Red flags:**
- Any change requires an expert in "everything at once."
- The shared layer keeps growing because "there's nowhere else to put it."

**Fitness functions:**
- Explicit ownership by context; a module with no clear owner signals a blurred boundary.
- A "how many contexts does the average PR touch" metric — rising means worsening boundaries.

---

## 11. Recording a finding

Capture each finding in this shape:

```
Dimension:        [5–10]
Principle:        [which idea — e.g. anti-corruption layer]
Observation:      [what you actually saw in the code/architecture]
Trade-off:        [what we gain/lose now; what we'd gain/lose by changing it]
Severity:         [blocker / high / medium / low]
Recommendation:   [a least-worst, incremental step]
Fitness function: [the check that locks it in]
```

**Worked example:**

```
Dimension:        5 (domain ↔ UI boundary)
Principle:        Anti-corruption layer
Observation:      Decoded extrinsic shapes and raw chain metadata from the chain
                  library are read directly inside three signing components. There
                  is no translation layer between SDK types and the view.
Trade-off:        Now: less code, quick to wire up. Later: a change in the SDK's
                  decoded shape — or supporting a second chain API — ripples into
                  every component that touched it. We are trading future
                  evolvability for present speed.
Severity:         High. Signing is a priority-quality area and these are high-churn
                  components.
Recommendation:   Introduce a thin ACL mapping SDK output to a domain
                  `SignablePayload`. Migrate one component first to validate the shape.
Fitness function: Import rule — SDK types may be referenced only inside the adapter
                  layer; components import the domain type only.
```

The example shows the point of the template: the *trade-off* line is what turns a complaint into a decision, and the *fitness function* line is what keeps the decision from quietly reverting.

---

## 12. Prioritization

Don't fix everything. Aim at the intersection of two axes:

- **Coupling** (dimension 6: high Ca, instability, cycles).
- **Change frequency** (the churn heatmap from section 3).

Modules that are both heavily coupled and frequently changed carry the most leverage — that's where coupling taxes velocity every day. Stable, rarely touched areas with poor coupling can be deliberately left alone, recorded as an accepted trade-off rather than silently ignored.

---

## Appendix. Sources — what each book contributes

- **Domain-Driven Design** (Evans; Khononov) — separating domain from UI; ubiquitous language; bounded contexts; the ACL at external boundaries. → dimension 5
- **Software Architecture: The Hard Parts** (Ford, Richards, Sadalage, Dehghani) — static/dynamic coupling vocabulary; qualitative trade-off analysis; "least-worst trade-off." → dimensions 6, 8
- **Building Evolutionary Architectures** (Ford, Parsons, Kua) — fitness functions; incremental change. → dimension 9
- **Designing Data-Intensive Applications** (Kleppmann) — source-of-truth vs derived; consistency across server/client/offline state; conflicts and optimistic updates. → dimension 7
- **Fundamentals of Software Architecture** (Richards & Ford) — explicit architectural characteristics and ADRs. → dimension 8
- **Team Topologies** (Skelton & Pais) — cognitive load and boundaries via Conway's Law; the "thinnest platform" idea for the UI Kit/SDK. → dimension 10
