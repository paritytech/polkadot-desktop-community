---
name: document-review
description: >-
  Use to refine a design or plan document in `docs/_plans/` before going on to the next workflow step. Applies when the
  document exists and needs improving, such as vague language, dead weight, unstated assumptions or scope creep.
---

# Document Review

Improve design or plan documents through structured review.

## Step 1: Get the Document

**If a document path is provided:** read it, then go on to Step 2.

**If no document is specified:** ask which document to review, or look for the most recent one in `docs/_plans/`:
`<topic>-design.md` for designs, `<topic>-plan.md` for plans.

## Step 2: Assess

Read through the document and ask:

- What is unclear?
- What is unnecessary?
- What decision is being avoided?
- What assumptions are unstated?
- Where could scope accidentally expand?

These questions surface issues. Don't fix yet, just note what you find.

## Step 3: Evaluate

Score the document against these criteria:

| Criterion        | What to check                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| **Clarity**      | The problem statement is clear, with no vague language ("probably", "consider", "try to")       |
| **Completeness** | Required sections present, constraints stated, open questions flagged                           |
| **Specificity**  | Concrete enough for the next step: a design concrete enough to plan, a plan enough to implement |
| **YAGNI**        | No hypothetical features, the simplest approach chosen                                          |

If invoked within a workflow (after `superpowers:brainstorming` or `superpowers:writing-plans`, through the
`architecture` skill), also check:

- **User intent fidelity.** The document reflects what was discussed, and its assumptions are validated.

## Step 4: Identify the Critical Improvement

Among everything found in Steps 2 and 3, does one issue stand out? If something would significantly improve the
document's quality, it is the "must address" item. Highlight it prominently.

## Step 5: Make Changes

Present your findings, then:

1. **Auto-fix** minor issues (vague language, formatting) without asking.
2. **Ask approval** before substantive changes (restructuring, removing sections, changing meaning).
3. **Update** the document inline, with no separate files and no metadata sections.

### Simplification Guidance

Simplification is purposeful removal of unnecessary complexity, not shortening for its own sake.

**Simplify when:**

- Content serves hypothetical future needs, not current ones
- Sections repeat information already covered elsewhere
- Detail exceeds what's needed to take the next step
- Abstractions or structure add overhead without clarity

**Don't simplify:**

- Constraints or edge cases that affect implementation
- Rationale that explains why alternatives were rejected
- Open questions that need resolution

## Step 6: Offer Next Action

After the changes are complete, ask:

1. **Refine again**: another review pass
2. **Review complete**: the document is ready

### Iteration Guidance

After 2 refinement passes, recommend completion, since returns are likely to diminish. If the user wants to continue,
allow it.

Return control to the caller (the `architecture` skill, or the user) after the selection.

## What NOT to Do

- Do not rewrite the entire document
- Do not add new sections or requirements the user didn't discuss
- Do not over-engineer or add complexity
- Do not create separate review files or add metadata sections
