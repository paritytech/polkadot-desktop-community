# Overview

This project is a Web/Electron app for browsing Polkadot products. It can run as a standalone web application or as an Electron
desktop app.

A product is an application or set of applications resolvable through dotNS (Polkadot on-chain naming) names. A product can have multiple presentations: an SPA, a widget, or a separate JS worker.

## General rules

- Do not preserve backward compatibility in logical modules. Remove obsolete paths instead of adding compatibility layers of fallbacks.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- Do not work around gaps in the SDKs and libraries the app depends on. When a dependency cannot do what the task needs, stop and describe the gap — what is required, what the library exposes, and what a workaround would cost — then wait for direction, which is usually either "fixed upstream, bump it" or "do X instead". Working around a dependency makes the app own that library's internals, and the hack outlives the gap.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.
- Run only the tests your change affects while you work. The full suite is a pre-commit/pre-PR step, not a per-iteration one — running it on every edit costs minutes each time and buys nothing the affected specs don't already tell you.
  - Known spec → `npx vitest run <path>`. **Not** `npm test -- <path>`: `npm test` chains three vitest projects and the filter reaches only the first, so the rest exit 0 under `--passWithNoTests` and the run **false-passes**. Confirm the output says `Test Files N passed`, never `No test files found`.
  - Don't know which specs cover a file → `npx vitest related --run <changed files>` runs every spec that imports them, transitively. `npx vitest run --changed` scopes to the git diff. A widely-imported file legitimately pulls in most of the suite — that is the tool working, not a reason to distrust it.
  - E2E: run the one relevant project (`npm run test:e2e:<project>`), never `test:e2e:all` mid-work.
  - Run the full `npm test` once before committing or opening a PR, and report that result — not the narrow run's. Inside the `architect` lifecycle each task commits after its fast checks instead, and the full suite runs where the `architecture` skill's step 7 sets (§ Step 7: Review, "The full suite").
- Report what you actually observed. If a change to UI or runtime behavior was not run, say that plainly instead of describing what it should do — an unrun change reported as working costs more than one reported as unverified.
- Every claim about this codebase cites the `file:line` you read in this session, or is labeled as inference. When a decision is questioned ("why is this X?", "check my reasoning"), re-open the file and the library's types before answering. Never construct a rationale for code you have not re-read — being wrong is cheap, a fabricated justification is not.

## Project agent

These rules bind the main session only. A subagent skips them.

A non-trivial change runs in the `architect` agent (.claude/skills/architecture/SKILL.md § Who runs this skill). While
`docs/_plans/project-agent.md` exists, read the agent ID from it and route each owner message:

- `p:` at the start sends the message to the agent and `m:` keeps it here. Strip the prefix.
- A reply to the agent's open `QUESTION`, `APPROVAL` or `BLOCKED` goes to the agent.
- Anything about that change goes to the agent: its design, plan, code, progress, a correction, a pause or a stop.
- Everything else is handled here as usual, without reading the change's plan.
- When unsure, ask the owner once whether it is for the project or for here.

Relay with `SendMessage` to the agent ID, as `OWNER: <the owner's words verbatim>`, plus the paths of any file the owner
attached. Never paraphrase, summarise or add an opinion. Never answer a question, pass a gate or decide for the owner,
even when the owner is away.

From the agent, show `QUESTION`, `APPROVAL`, `BLOCKED` and `DONE` verbatim. Offer a `QUESTION` or `BLOCKED` with options
through `AskUserQuestion` and relay the chosen label and any notes. Show a `STATUS` as one line. A finished turn of the
agent only means it is waiting, unless its message is `DONE`. Never stop or replace the agent before `DONE`, not even at
a gate, unless the owner stops the change. After `DONE`, or when the owner stops the change, delete
`docs/_plans/project-agent.md`, except between the stages of a staged change.

A staged change (.claude/skills/architecture/SKILL.md § A staged change) runs one agent per stage, and
`project-agent.md` also records the roadmap path and the current stage. After the roadmap's or a stage's `DONE`, show
it, then start the next stage's agent without asking the owner, who approved the roadmap. Dispatch it as that skill's
"Who runs this skill" does, with the owner's roadmap approval verbatim as `OWNER: <text>` plus
`Stage: <roadmap path> § <stage>`, and update `project-agent.md`. Delete the file only after the last stage's `DONE`, or
when the owner stops the change.

## Code navigation

Resolve **symbol** questions with the LSP tool, not with grep + Read. The server is the project's own TypeScript 7 binary (`@typescript/native`) in LSP mode — the same Go engine WebStorm runs — wired via the `typescript-lsp-native` plugin in `.claude/plugins/`. First-time setup on a new machine:

```bash
claude plugin marketplace add "$(git rev-parse --show-toplevel)/.claude/plugins"
claude plugin install typescript-lsp-native@polkadot-desktop-local
```

- "who calls / uses this" → `findReferences`, `incomingCalls` — these traverse the barrel `index.ts` re-exports that every domain uses as its public surface, and they exclude README prose and `vi.mock` properties. Grep does neither.
- "where is this defined / what's its type" → `goToDefinition`, `hover`. Position is 1-based and must land on the **identifier**, not the line start.
- "what symbols match this name" → `workspaceSymbol` (returns names + kinds).

Grep/Glob remain correct for free-text, filename patterns, and non-code files.

**Enforcement.** A PreToolUse hook (`.claude/hooks/prefer-lsp-for-symbols.sh`) **denies** — not nudges — a search whose pattern is a code identifier (bare, with an internal case transition). It covers both the `Grep` tool and `Bash(grep|rg|…)`, and it splits `\|` alternations, so a multi-symbol search is caught too. Free text, single dictionary words, quoted patterns with regex metacharacters, and unquoted paths all pass through. If a blocked call really is text matching — filtering command output, searching docs or prose — add the literal marker `# free-text` to the command and re-run.

A SessionStart hook (`.claude/hooks/preload-lsp-tool.sh`) tells you to load the deferred `LSP` tool immediately. Do it before the first search: grep is always resident and LSP is not, and that friction gap — not this rule — is what decides which tool gets reached for mid-task.

The `LSP` tool may be deferred — if it isn't in your tool list, load it once with `ToolSearch("select:LSP")` before the first query. This applies to subagents too: agents with full tool access (`Explore`, `general-purpose`, `typescript-developer`) can use LSP, but must load it the same way. Agents with an explicit tool list that omits `LSP` (`feature-dev:*`, `claude-code-guide`) cannot — send code-navigation work to `Explore` instead.

> **Cold start:** the first semantic query in a session pays ~0.7 s while the project graph loads; after that, queries run between 0.2 ms and ~20 ms depending on result size. The first answer is already complete — returning only the declaration was the old Node `tsserver`'s failure mode, and it persisted across retries rather than warming up. If you ever do see a suspiciously lonely reference result, treat it as a bug worth reporting, not as something to retry around.

## Known Claude commands

- `/create-feature <feature-name>` - Create a new feature boilerplate in `features` directory. If a feature already exists —
  review it and adjust according to defined structure
- `/create-domain-module <domain-name> <module-name>` - Create a new domain module boilerplate in `domains` directory.
- `/commit-and-push` - Stage all modified/new files and push to the current branch.
- `/pr-message` - Draft a pull request message from template.

## Project skills

These skills (under `.claude/skills/`) carry the project's procedural rules. They are part of the contract — don't reimplement guidance they own.

> **Required plugin dependency:** the `superpowers` plugin (`superpowers@claude-plugins-official`) is declared in `.claude/settings.json` so the whole team/CI gets it.

- `architecture` — **entry point for any non-trivial code change, and the whole lifecycle** (frame → size → place → design → plan → plan review → implement in review batches → review → fix → rule extraction). The main session never runs its steps: it dispatches the `architect` agent (`.claude/agents/architect.md`), which runs the change in its own context and talks to the owner through the main session (see § Project agent). Orchestrates `code-placement`, `domain-development`, `feature-development`; delegates brainstorming, plan-writing and implementation to `superpowers`; gates implementation on design and plan approval; checks every plan with `scripts/checkPlanNames.ts` before a fresh-context review pass; hard-stops on a discovery that breaks the plan; and runs `reviewer` as the mandatory post-implementation gate. Run it first, always.
- `document-review` — refines a design or plan document in `docs/_plans/` (clarity, YAGNI, unstated assumptions, scope creep) and edits it inline. Invoked by `architecture` twice: on `<topic>-design.md` before the approval gate, and on `<topic>-plan.md` before the fresh-context plan review. Not a substitute for that review — it runs in the authoring context and does not verify the plan against the repo.
- `code-placement` — fires first when the target layer is uncertain (domain / aggregate / feature / widget / shared). Entry point for "where does this go?".
- `domain-development` — fires when working in `src/domains/`. Points at `docs/code/domain-development.md`.
- `feature-development` — fires when working in `src/features/` or `src/routes/` files that host features. Points at `docs/code/feature-development.md`.
- `code-placement`, `domain-development` and `feature-development` run inside the `architect` agent for a non-trivial change; the main session dispatches the agent and does not place the change itself.
- `react-best-practices` — fires when writing/reviewing/refactoring React code. Performance and rendering rules in `rules/`.
- `run-app` — launches and drives the real Electron app (Playwright REPL at `e2e/driver.ts`) for screenshots and visual
  validation of a change. Renderer hot-reloads inside Electron via `RENDERER_SOURCE=localhost`.
- `reviewer` — audits a branch diff / PR against this project's checklists (`docs/claude/`) with blocking/major/minor severity, numbered B1/M1/m1. Every finding is fixed in the branch, minor included. Also runs as a scoped re-review of a fix's commit range. Project-rule-aware; complements the generic `/code-review`. Run after a change, before merge.

## Project Structure

> **MANDATORY — start every code change with the `architecture` skill.** Before writing or changing any non-trivial code in `src/` (new code, new/moved/renamed files, a new abstraction, extending behavior, or a refactor that relocates logic), the `architecture` skill runs first — the main session dispatches the `architect` agent for it (§ Project agent) and does no framing, reading or exploring of its own. It is the single entry point that decides _what_ the change is and _where_ it goes, orchestrating `code-placement`, `domain-development`, and `feature-development`, and produces a design and a plan in `docs/_plans/`. Do not generate a file path, pick a layer, or open the flow docs yourself before running it — this does not depend on the skill auto-activating. Inside `src/domains/`, a leaf/container module may ONLY contain the file kinds enumerated below (`types`, `service`, `resource`, `hooks`, `gateway`, `repository`, `schemas`, `constants`, `index`, `README`, `bootstrap`, `$usecase/`) — the PreToolUse hook blocks new non-canonical files outright. If your logic has no canonical home, STOP and ask — never invent a new filename (e.g. `changes.ts`, `manager.ts`, `helpers.ts`) to resolve the ambiguity. Skip the skill only for trivial in-place edits within one existing file (`docs/code/glossary.md` defines the threshold). A subagent the `architect` dispatches skips this paragraph: its brief and the plan are its scope.

@docs/code/project-structure.md

## Code style

@docs/code/style.md

## Development flows

- Adding or extending business logic → [docs/code/domain-development.md](./docs/code/domain-development.md).
- Building user-facing scenarios → [docs/code/feature-development.md](./docs/code/feature-development.md).
- Finding the seam (when domain/feature boundary is unclear) → [docs/abstract/event-storming.md](docs/abstract/event-storming.md).
- Sizing a change before designing it (blast radius vs braid — "looks easy, is complex") → [docs/abstract/simple-vs-easy.md](docs/abstract/simple-vs-easy.md).
- Auditing a change before merge → the `reviewer` skill (checklists in [docs/claude/](docs/claude/); review output to [docs/\_reviews/](docs/_reviews/)).
- Thresholds (trivial vs non-trivial, peer file, composition) → [docs/code/glossary.md](./docs/code/glossary.md).
- Turning a recurring correction into a durable rule → [docs/code/rule-extraction.md](./docs/code/rule-extraction.md). Code and workflow corrections become repo rules, never agent memory (docs/code/rule-extraction.md § When to run).

Always check whether the change belongs in a domain before touching a feature.

## Stack

- **TypeScript** - Primary language
- **React** - UI framework
- **RxJS** - Reactive programming for data streams
- **Immer** - Immutable cache updates (`produce`)
- **Vite** - Build tool
- **Electron** - Desktop app shell
- **TanStack Router** (`@tanstack/react-router`) - File-based routing from `src/routes/`
- **Valibot** - Schema validation
- **Tailwind CSS 4** - Styling
- **@novasamatech/tr-ui** - Main UI kit
- **polkadot-api** - Polkadot chain interaction
- **Dexie** - IndexedDB persistence
- **Vitest** + **React Testing Library** - Unit tests
- **Playwright + playwright-bdd** - E2E tests (Electron)
- **react-intl** - i18n

## Key Patterns

### Dependency Injection (DI) System

@docs/code/di.md

### Effector Utilities (deprecated)

Located in `src/shared/effector/`. Custom utilities for Effector state management. **Do not use in new code** — features must not depend on Effector (see `docs/code/project-structure.md`). Listed here only for navigating existing code:

### E2E Tests

See [e2e/CLAUDE.md](e2e/CLAUDE.md) for writing tests and [e2e/README.md](e2e/README.md) for architecture.

> **Keep docs in sync:** When changing E2E test architecture, fixtures, conventions, or adding new projects/features — update
> `e2e/CLAUDE.md` (rules for AI) and `e2e/README.md` (architecture for developers) accordingly.

## Commands

```bash
# Development
npm start                # Electron dev (main + preload + renderer + electron, watches all)
npm run start:web        # Web-only renderer dev server (Use this for developing web-only features)

# Building
npm run build            # Production build (main + preload + renderer)
npm run build:dev        # Development build of all three targets
npm run build:staging    # Staging build

# Packaging (Electron)
npm run dist             # Package the Electron app (electron-builder). Needs APP_ID, PRODUCT_NAME
                         # and APP_NAME — there is no default identity and packaging refuses
                         # without them. BUILD_TYPE=production picks those three; anything else
                         # prefers their _DEVELOP variants. See docs/PUBLISHING.md section 4.

# Testing
npm test                       # Run unit tests
npm run test:watch             # Watch mode
npm run test:coverage          # Coverage report

# E2E Testing
npm run build:e2e              # Build for e2e (AUTOTEST + filesystem renderer)
npm run test:e2e               # Smoke tests
npm run test:e2e:auth          # Auth flow tests (sign-in, logout)
npm run test:e2e:authenticated # Authenticated session tests
npm run test:e2e:product-sdk   # Product SDK tests (Accounts, Signing, etc.)
npm run test:e2e:chat          # All chat tests (contact search + two-client Alice+Bob pair)
npm run test:e2e:all           # All BDD tests (smoke, auth, authenticated, product-sdk, chat, link-navigation, browser)
npm run test:e2e:security      # Security probe tests
npm run test:e2e:ui            # Playwright interactive UI mode
npm run test:e2e:record        # Launch Electron with Playwright Inspector for recording

# Code Quality
npm run lint             # Lint code
npm run lint:fix         # Fix lint issues
npm run types            # Type check
npm run fmt:check        # Check formatting
npm run fmt:fix          # Fix formatting

# Polkadot API
npm run papi:generate    # Generate Polkadot API types
npm run papi:update      # Update Polkadot API metadata

# Misc
npm run knip             # Detect unused files/exports/dependencies
node scripts/checkPlanNames.ts <plan> [--base <rev>]  # Look up every name a docs/_plans plan cites (architecture plan review)
npm run test:scripts     # node:test specs of scripts/ (part of npm test)
npm run storybook        # Run Storybook dev server
npm run storybook:build  # Build static Storybook
```
