# Rule extraction — closing the feedback loop

The problem this solves: a correction the user makes in one session evaporates at its end, so the next session repeats the mistake. Rule extraction turns a durable correction into a durable rule — appended to the docs and mirrored into a reviewer checklist — so it's enforced from then on.

This runs at the end of an `architecture` (planning) or implementation pass. It is **silent and skipped** when the user made no substantive corrections. Don't invent candidates to have something to propose.

## When to run

After the user has accepted the plan or the implementation, check whether **substantive** corrections happened during the session. Substantive = more general than this one task:

- "X should always go in Y, not Z." / "We don't do Z — we use W."
- A direct edit reversing a choice (renaming a type, moving a file, changing a pattern).
- "When you do X, also do Y." / "Don't bake Z into the model — extract it."
- A lint warning the user explicitly endorsed as a general rule.

**Ignore** task-specific corrections: a single variable name, one magic number, exact wording of one string. Those don't generalize.

## Procedure

1. **Re-read the session.** Collect each substantive, generalizable correction.
2. **Form candidate rules** — one line each, prescriptive ("do X when Y" / "don't do Z"), severity-tagged (`blocking` / `major` / `minor`), with a target doc § and a one-line *why* (quote the user's rationale where given). **Cap at 5 per session**; if more surface, present the top 5 and note the rest are in the conversation.
3. **Ask one candidate at a time** via `AskUserQuestion`:

   > **Rule:** `<severity>` — <one-line rule>
   > **Why:** <rationale, quoting the user where possible>
   > **Where:** `<doc § section>` + matching checklist row

   Options: `Add as proposed` / `Add with my wording` / `Skip — not a general rule`.
4. **On approval**, edit the target doc:
   - Append the rule to the matching `docs/code/*.md` section (most placement rules → `project-structure.md`; code rules → `style.md`; DI → `di.md`).
   - Mirror a one-line entry into `docs/claude/architecture-checklist.md` or `code-checklist.md` so the reviewer can cite it.
   - If the rule is mechanically enforceable, note it as a candidate for an ESLint rule (greppable style rules) or `.claude/hooks/guard-protected-paths.sh` (path/structure hard-blocks).
   - Confirm what was added and where.
5. **On `Add with my wording`** — ask the user to dictate; add using their phrasing.
6. **On `Skip`** — drop it; don't raise it again this session.

## Where rules land — routing

| Correction is about… | Doc | Checklist mirror |
|---|---|---|
| Layer choice, module/file placement, dependency direction | `project-structure.md` / `code-placement.md` | `architecture-checklist.md` |
| A coding pattern (types, React, hygiene, data access) | `style.md` | `code-checklist.md` |
| A DI identifier / extension-point convention | `di.md` | `architecture-checklist.md` |
| A new threshold definition | `glossary.md` | — |

## Why mirror into a checklist and a hook

Three enforcement layers, weakest to strongest: **doc** (read on demand) → **checklist** (cited by the reviewer) → **ESLint / PreToolUse hook** (mechanical, can't be skipped). A rule that lives only in a doc depends on the agent recalling it. Push every mechanically-enforceable rule down to ESLint (style) or the PreToolUse guard (path/structure); keep the doc + checklist for the judgment-call rules a regex can't express. The reviewer is the safety net for everything in between.
