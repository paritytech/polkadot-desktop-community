# Rule extraction — closing the feedback loop

The problem this solves: a correction the owner makes in one session evaporates at its end, so the next session repeats the mistake. Rule extraction turns a durable correction into a durable rule — appended to the docs and mirrored into a reviewer checklist — so it's enforced from then on.

It is **silent and skipped** when the owner made no substantive corrections. Don't invent candidates to have something to propose.

## When to run

Run it in two cases:

- At the end of a change, after the owner has accepted the plan or the implementation.
- Whenever the owner corrects a code or workflow choice, during a change or outside one. The rule goes to the repo through this procedure, never into someone's private notes.

Run it only when the session holds **substantive** corrections. Substantive = more general than this one task:

- "X should always go in Y, not Z." / "We don't do Z — we use W."
- A direct edit reversing a choice (renaming a type, moving a file, changing a pattern).
- "When you do X, also do Y." / "Don't bake Z into the model — extract it."
- A lint warning the owner explicitly endorsed as a general rule.

**Ignore** task-specific corrections: a single variable name, one magic number, exact wording of one string. Those don't generalize.

## Procedure

1. **Re-read the session.** Collect each substantive, generalizable correction.
2. **Form candidate rules** — one line each, prescriptive ("do X when Y" / "don't do Z"), severity-tagged (`blocking` / `major` / `minor`), with a target doc § and a one-line _why_ (quote the owner's rationale where given). **Cap at 5 per session**; if more surface, present the top 5 and note the rest are in the discussion.
3. **Ask the owner one candidate at a time:**

   > **Rule:** `<severity>` — <one-line rule>
   > **Why:** <rationale, quoting the owner where possible>
   > **Where:** `<doc § section>` + matching checklist row

   Options: `Add as proposed` / `Add with my wording` / `Skip — not a general rule`.

4. **On approval**, edit the target doc:
   - Append the rule to the matching `docs/code/*.md` section (most placement rules → `project-structure.md`; code rules → `style.md`; DI → `di.md`).
   - Mirror a one-line entry into `docs/claude/architecture-checklist.md` or `code-checklist.md` so the reviewer can cite it.
   - If the rule is mechanically enforceable, note it as a candidate for an ESLint rule.
   - Confirm what was added and where.
5. **On `Add with my wording`** — ask the owner to dictate; add using their phrasing.
6. **On `Skip`** — drop it; don't raise it again this session.

## Where rules land — routing

| Correction is about…                                      | Doc                                          | Checklist mirror            |
| --------------------------------------------------------- | -------------------------------------------- | --------------------------- |
| Layer choice, module/file placement, dependency direction | `project-structure.md` / `code-placement.md` | `architecture-checklist.md` |
| A coding pattern (types, React, hygiene, data access)     | `style.md`                                   | `code-checklist.md`         |
| A DI identifier / extension-point convention              | `di.md`                                      | `architecture-checklist.md` |
| A new threshold definition                                | `glossary.md`                                | —                           |

## Why mirror into a checklist and a lint rule

Three enforcement layers, weakest to strongest: **doc** (read on demand) → **checklist** (cited by the reviewer) → **ESLint** (mechanical, can't be skipped). A rule that lives only in a doc depends on the reader recalling it. Push every mechanically-enforceable rule down to ESLint; keep the doc + checklist for the judgment-call rules a regex can't express. The reviewer is the safety net for everything in between.
