<!--
================================================================================
DOMAIN README TEMPLATE
================================================================================
Copy this file to `src/domains/<domain>/README.md` and fill it in. Delete every
HTML comment (like this one) as you go — they are guidance, not content.

WHAT THIS FILE IS. The domain README is the domain's glossary and ubiquitous
language: the canonical name for every concept the domain owns, the rules of
what it does and does not own, and the consumer-facing flows that put those
concepts in motion. A reader who finishes it should understand what the domain
is for and how to use it — without reading the source. It is prose + tables,
never a file-layout dump or a signature reference (that drifts; the code is the
source of truth for shape). Name the public entry points consumers actually call
(use cases, hooks, services); do not document internals.

STRUCTURE (in order). Each `##` section below is explained inline.
  1. Title + Overview   — what the domain is, in two short paragraphs
  2. Vocabulary         — the ubiquitous language (the glossary)
  3. Scope              — what this domain owns
  4. Flows              — how the vocabulary moves (the "how it works")
  5. Boundaries         — what this domain deliberately does NOT own
  6. References         — external specs/packages + key in-repo files

WHY THIS ORDER. Overview frames the domain; Vocabulary gives the words; Scope
draws the ownership line; Flows show the words in motion; Boundaries draw the
line from the other side; References point deeper. Vocabulary precedes Flows
because the flows are written in that vocabulary.

EXEMPLARS to read before writing:
  - `src/domains/network/README.md` — lean: flat Vocabulary, one flow section.
  - `src/domains/product/README.md`  — rich: grouped Vocabulary, several flows,
                                       a state table, and an invariants list.
Match the codebase conventions in `docs/code/project-structure.md`
(the `README.md` file contract) and `docs/code/domain-development.md`.

SCALE TO THE DOMAIN. Sections marked OPTIONAL below earn their place only when
the domain is big enough to need them. A small domain may be ~50 lines with a
flat Vocabulary and a single flow; don't pad it to look like `product`.
================================================================================
-->

# <domain-name>

<!--
OVERVIEW (no heading — these are the opening paragraphs).
Paragraph 1: "The `<domain>` domain owns ..." — one sentence naming, in plain
terms, what this domain is responsible for. List the major capability areas.
Paragraph 2: the framing sentence — the single idea that orients the reader.
Every exemplar has one:
  - network: "It is deliberately a read/connect layer. It owns *how* to reach a
    chain ... It does not sign ..."
  - chat:    "The unit of consumption is a `ChatSession`: a uniform observable
    interface ..."
  - application: "It is the seam between the host shell and the rest of the
    renderer."
State the load-bearing distinction or the unit of consumption here. If you can't
write this sentence cleanly, the domain's model probably needs work.
-->

The `<domain-name>` domain owns <one-sentence statement of responsibility, naming the major areas>.

<Framing paragraph: the one idea that orients the reader — the unit of consumption, the load-bearing distinction, or the "deliberately an X layer" stance.>

## Vocabulary

<!--
The glossary and ubiquitous language — one canonical name per concept, used
identically in code, design, and product talk. This is the heart of the README.

FORMAT: `- **Term** — definition.` Where a concept is backed by a concrete type,
use case, resource, or file, name it (e.g. "Schema: `RootManifest` in
`manifest/schemas.ts`"). Where a concept has tempting synonyms, say which word to
use and which to avoid (e.g. account vs address vs signatory).

GROUPING: a flat bullet list is fine for a small domain (see `network`). When the
terms cluster into 2+ unrelated groups, split them under `###` subheadings named
after the cluster (see `product`: Resolution / Manifest / Sandbox / Offline pin,
or `chat`: Session-level / P2P-specific / Product-specific). Group only when it
aids reading — don't invent groups for five terms.

Keep definitions tight. Define the term; don't narrate the flow here (that's the
Flows section).
-->

### <Group name (optional — drop the `###` if the list is flat)>

- **<Term>** — <definition; name the backing type/file where it helps; flag synonyms to avoid>.
- **<Term>** — <definition>.

## Scope

<!--
What this domain owns — the affirmative half of the ownership boundary. A bullet
list, each item a capability area (not a file). Bold the capability, then a short
clause. See every exemplar's "This domain owns:" list. This is what a reader
checks to answer "should my change live here?".
-->

This domain owns:

- **<Capability>** — <what, concretely, this domain is responsible for>.
- **<Capability>** — <...>.

<!--
OPTIONAL — "Why one domain, not several." If the domain bundles areas that could
plausibly stand alone, justify the cohesion in a short paragraph (see `product`).
Skip for a focused domain.
-->

## <Flow name — e.g. "Reading an X (which hook?)", "Committing an X", "Accessing the Y">

<!--
THE FLOWS — how the vocabulary moves. This is what the user asked the README to
explain: the consumer-facing scenarios. One `##` section per distinct flow;
title it after the action or the question it answers, in the domain's vocabulary.

WHAT GOES HERE:
  - The sequence of what happens (prose, or numbered steps, or a small table).
  - The public entry points a consumer calls — name the use cases / hooks /
    services and WHEN to reach for each. (See product's "Reading a product"
    list, network's "Accessing a chain API".)
  - State machines / lifecycles as a transition list or table (see product's
    "Lifecycle states" + state table).
  - Invariants the flow guarantees, if any (see product's "Invariants" list).
  - A "Rule of thumb:" closing line when there's a common decision a caller
    makes (which hook? which entry point?). network and product both do this.

WHAT TO AVOID: signatures, parameter lists, internal file walkthroughs, and
anything that restates the code line-by-line. Describe behavior and choice, not
implementation.

For a complex flow, a rendered diagram can live in `docs/code/` and be linked
from here (see product → `docs/code/product-resolution-model.html`). Keep the
README self-sufficient in prose; the diagram is a companion, not a dependency.

Repeat this `##` section for each meaningful flow. A small domain may have one.
-->

<Describe the flow: the sequence, the entry points and when to use each, any state table or invariants.>

Rule of thumb: <the common decision a caller makes, stated as a one-liner>.

## Boundaries

<!--
What this domain does NOT own — the negative half of the boundary, and often the
more useful half. For each excluded concern, name where it actually lives, so the
reader is redirected, not just refused. See every exemplar's "does not own" list.
Include the near-misses: the things a reader might reasonably expect here but
that deliberately sit elsewhere (e.g. network: "Signing ... lives in
domains/product/account"; chat: "The transport itself ... owned by
domains/application").
-->

This domain does **not** own:

- **<Excluded concern>** — <where it lives instead, and why the split>.
- **<Excluded concern>** — <...>.

## References

<!--
Pointers for going deeper. Two kinds, both welcome:
  - External: specs, RFCs, and the npm packages this domain is built on, each
    with a clause on what it's used for.
  - In-repo: the key data file, companion diagram, or sibling README a reader
    should know about (e.g. a chain catalog JSON, a `docs/code/*.html` companion,
    a sub-module README).
Every external link a maintainer needs lives here, not scattered through the body.
-->

- [<spec / package>](<url>) — <what it is / what this domain uses it for>.
- [`<in-repo path>`](<relative-link>) — <what it is>.
