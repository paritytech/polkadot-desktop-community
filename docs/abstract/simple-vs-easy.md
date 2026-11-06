# Simple vs easy

A sizing framework for a change, run before the design is brainstormed. It answers one question the one-sentence frame cannot: **what does this actually cost — now, and on every change after it?**

External reference: Rich Hickey, "Simple Made Easy" talk (InfoQ, 2011).

## The two axes

They are independent, and collapsing them is the failure this framework exists to prevent.

**Simple ↔ complex** — a property of the **artifact**. _Complex_ is Hickey's `complect`: to braid together. Two concerns are complected when you cannot change one without touching the other. Objective and countable: how many concerns live in the place you're editing, and how many places does the concern you're adding live in.

**Easy ↔ hard** — a property of **you, right now**. Near at hand: familiar, already installed, small effort, short diff. Relative and temporary.

A 90-file mechanical rename is **hard and simple**. A three-line flag on a shared path is **easy and complex** — it costs nothing today and taxes every change that path ever sees again. Judging a change by its diff size measures only the easy axis.

The trap the framework catches: **framing a change in one sentence is what makes it look easy.** The sentence is about the concern; the cost is about the braid the concern is already caught in.

## The probe

Three questions. Answer them with **repo evidence, not intuition** — a language server (find references, the call hierarchy) makes blast radius measurable, so guessing it is a choice.

1. **Who must change with me?**
   List the symbols and public surfaces the change touches. Find the references of each one. Count **files**, **modules** and **layers** (`docs/code/glossary.md` § Scope).

2. **Why must they change?**
   Per call site: does it genuinely _use_ the thing (unavoidable — it asked for this value), or is the concern _braided into_ it (it never wanted this value and now must carry it)? Forty sites threading a new parameter is not forty units of work — it is the codebase reporting that the value is already complected with its callers. **Large radius is a measurement of existing complexity, not a property of your change.**

3. **Am I adding braid or removing it?**
   Adding: a new flag on a shared path, a new field on a shared type, a new branch others must now know about, a parameter threaded through code that has no use for it. Removing: a concern that lived in N places now lives in one; a caller that stops needing to know something.
   This cost never appears in the current diff — it is paid by every future change.

## The classification

The probe places the change in one cell. Each cell has a mandated move.

|                            | **Radius matches the frame**                                         | **Radius contradicts the frame**                                                                                |
| -------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Removes or keeps braid** | Proceed. This is the normal case.                                    | Worth doing, but it is a **project, not a task**: STOP. Report the measured count, propose stages, owner picks. |
| **Adds braid**             | **The trap.** STOP. Name the braid, present the decomplected option. | STOP. Not a judgment call to make alone.                                                                        |

**"Radius contradicts the frame"** is deliberately relative, not a file count. The frame states the change in **one module's vocabulary** (`docs/code/glossary.md` § Scope); if the measured radius spans three modules or layers, or reaches public surfaces the sentence never mentioned, the frame and the artifact disagree. That gap is the finding — report the gap, not a number.

**Why the small-radius/adds-braid cell stops just as hard.** Nothing downstream catches it. The diff is small, the plan is short, the review passes, the tests are green — and the cost lands on someone else, months later. It is the only cell that never self-corrects.

**A stop is not a refusal.** It is a report: here is the measured radius, here is what is braided with what, here are the options and their costs. The owner decides; the framework only refuses to let that decision be made silently by an agent that framed the task in one sentence and started typing.

## Worked example

Branch `feat/dotns-network-tld`, framed as: _"resolve dotNS names against the network's TLD instead of a hardcoded one."_ One sentence, one domain's vocabulary — it reads as bounded.

```
$ git diff --stat main...HEAD | tail -1
 87 files changed, 1055 insertions(+), 498 deletions(-)

$ git diff --name-only main...HEAD | cut -d/ -f2 | sort -u
aggregates  domains  features  routes  shared  widgets
```

The frame named one domain. The artifact spans six top-level areas including the i18n locales and route hosts. The gap between those two lines **is** the finding, and it was available before the first edit: finding the references of the TLD-carrying symbols would have reported it in seconds.

Note what the finding is _not_: it is not "this change was wrong." Question 2 is what settles that — every call site that had to change because it threads a TLD it never asked for is a site where the TLD was complected with the caller. The radius is the measurement of that pre-existing braid. The right response might be to proceed in staged PRs, or to decomplect first and change second — but that is a decision to take deliberately at 87 files, not to discover at file 60.

## Rationalizations to flag

Each of these is the easy axis arguing it is the simple axis:

| Thought                                          | What it actually means                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| "It's just one more parameter"                   | Complecting every caller with a value it does not own.                                                 |
| "I'll add a flag so both behaviors work"         | Two behaviors braided into one path. (The project ban on compatibility layers is this rule, narrowed.) |
| "Just add a fallback here"                       | Policy braided into mechanism.                                                                         |
| "It's the same shape as what's already there"    | Familiar ≠ simple. Consistency with a complected pattern propagates the braid.                         |
| "It's only a small diff"                         | Diff size is the easy axis. It reports nothing about braid.                                            |
| "I'll clean it up in a follow-up"                | The braid ships; the follow-up is unfunded.                                                            |
| "Most of those files are just call-site updates" | That is question 2's answer, and it is the evidence _for_ complecting, not against it.                 |

## Reporting the probe

Run the probe after the frame, **before** brainstorming spends effort designing a change whose cost is unmeasured. Report it in three lines:

```
Radius:  <N files, K modules, M layers> — <symbols measured>
Braid:   adds | removes | neutral — <what is braided with what>
Cell:    <cell> → <mandated move>
```

Then take the cell's move. On any STOP cell, present 2-3 concrete options with their costs and wait — this is the same weight as the design-approval gate, not an advisory note.

If the probe is expensive to run, that is itself a signal: a change whose blast radius cannot be measured in a few find-references lookups is not a change anyone can size by reading the sentence.

**At review time** the same two axes are measured against the **frame**, not the plan — the plan is what grew, so it cannot be the yardstick (rows in `docs/claude/architecture-checklist.md` § Complexity). Two things change once the code exists:

- **Radius is a report, never blocking.** The cost is sunk; the useful output is a staging proposal and the question of whether the probe was run at all.
- **Braid is still actionable**, and this is the last gate that can see it — it breaks no import rule, sits in a canonical file, and passes lint. After merge, only the people paying for it will notice.

Attribute honestly: a large radius usually measures complecting the author **inherited**. Saying so is the difference between a finding that gets fixed and one that teaches the next author to keep the number quiet.
