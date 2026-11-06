# Code style

Most rules below are enforced by ESLint (`eslint.config.js`) — `npm run lint` to check, `npm run lint:fix` to auto-fix.

## Files and tests

- Source: camelCase (`createQueryResource.ts`). React components: PascalCase (`HomeButton.tsx`).
- Unit tests co-located as `*.spec.ts`.
- DOM/React tests co-located as `*.test.tsx`, using `@testing-library/react` with `happy-dom`.
- Inside a domain, what a file _is_ decides whether it gets a spec: `service.ts` and `$usecase/*.ts` always, `resource.ts` /
  `repository.ts` / `schemas.ts` never — see [domain-development.md § Testing](./domain-development.md#testing) for the rule
  and its reasons. One consequence worth spelling out: a resource `key` and its cache `map` computing different strings silently
  strands `invalidate()`, and the defense is calling the same key function in both places, not a spec.
- A resource serves its builder-declared `.mock(fn)` in every unit test (`vitest.setup.js` sets the execution environment to
  `test`). That mock is the resource's default shape, not a scenario: to assert an exact flow on chosen inputs, call
  `resource.instead(fn)` inside the test and return what that case needs, including a rejection or a stream you push to. `instead`
  outranks the mock, applies to every read of that resource for the rest of the test, and is undone after each test. The same
  `afterEach` — `resetExecutionEnvironment()` — empties every resource's cache and returns every `RxState` to its initial value, so
  a test never inherits a value the previous one produced and never observes a cache that is already warm when it means to wait
  for a read.
- Avoid `vi.mock` at all cost. It replaces a module for everyone who imports it, so the test no longer exercises the wiring it
  claims to cover, and a stub that drifts from the real signature keeps passing (a hook that returned a value synchronously on
  every render hid a real bug in `useObservable`'s subscribe-on-commit timing). Design the code so a test can hand it a double
  through the language instead: a collaborator arrives as a **parameter with a default** (`fn(input, deps = realDeps)`), a
  factory takes its adapters as arguments, a resource is driven with `instead`, a DI identifier with `registerHandler`, and a
  library boundary with the in-memory or fake implementation the library itself ships (`createInMemoryStatementStore`,
  `fake-indexeddb`). If none of those reach the seam, the seam is missing — add the parameter rather than the mock. The only
  `vi.mock` that has earned its place is one that cuts a genuine host boundary the code cannot take as an argument (Electron
  IPC, a native module, the module graph cycle behind a barrel), and it says why in a comment right above it.
- A `useRead` resource re-renders when it settles, a tick after mount, often from a hook deep in the subtree. Assert synchronously and that settle warns `not wrapped in act`. Await it: `await screen.findBy…` / `await waitFor(() => expect(...))` flushes the settle inside `act`, even an invisible one, for the whole subtree. Don't mock the child's read hook to dodge it, and don't drain a bare microtask (`await act(async () => {})`). When the test itself triggers the update, wrap that call in `act(() => ...)`.

## Imports

- Use the `@/` alias for `src/` — relative imports across layers are forbidden.
- Inline type imports: `import { type Foo } from '...'` — never a separate `import type` line.
- Remove unused imports/variables; prefix intentionally unused args with `_`.
- Max **25** module imports per file (type imports excluded).

## TypeScript

- Use `type`, not `interface`.
- No classes. The one exception is a test double for a platform constructor the code under test calls with `new` (`RTCPeerConnection`, `ResizeObserver`): there is no function form that satisfies it. Production code has no such case.
- String-literal enums.
- No `as` assertions in production code. If unavoidable, disable the rule on that line with a justification. Tests and `**/mocks/*.ts` are exempt.
- Array type: `T[]`, not `Array<T>`.
- Use the global `Nullable<T>` / `NullableMap<T>` from `src/shared/types/`.
- DI identifiers follow `local-rules/enforce-di-naming-convention` (see `di.md`).

## Comments

**The test: a comment must carry what the code cannot.** If deleting it loses nothing a reader could recover by reading the code itself, delete it. Code is the description of _what_ happens and is kept honest by the compiler and the tests; a comment is not, so it earns its place only by holding information that has nowhere else to live.

Write a comment when it is one of these:

- **Why, not what** — the constraint that forced this shape: a spec/RFC clause, an upstream bug, a protocol quirk, or the reason the obvious approach does not work. The reader can see the code; they cannot see what you rejected.
- **An assumption or invariant the code relies on but cannot enforce locally** — a guarantee the caller must uphold, a required ordering, an expectation about chain or peer behavior. Example: `src/features/call/state/callActivity.ts:5` records that a single active call is assumed.
- **A temporary state or deferral** — a workaround, a migration half-done, a branch that exists only for an old client. **It MUST name the condition that removes it**, in the existing form: `// TODO(<scope>): <what> when <condition>`. A deferral with no exit condition is not a comment, it is rot — finish it in this branch (`docs/claude/architecture-checklist.md § Complexity`).
- **TSDoc on a public surface** — a `/**` block on something exported through a domain / aggregate / feature `index.ts`, describing the contract for callers who will never open the file. Not on internal helpers.

Do not write a comment that:

- **Restates the code** (`// increment the counter`, `// map over products`) — this is the common case and it is always deletable.
- **Explains a name that should be renamed instead.** Fix the name; the comment is a workaround for it.
- **Records history** — who changed it, what it used to be, a ticket it came from. Git owns that, and unlike the comment, git stays correct.
- **Is commented-out code.** Delete it.
- **Is a section banner or divider.** A file that needs internal signposting is a file that should be split.

Not every line needs the full context of the system around it. When in doubt, leave it out — an absent comment costs a reader one lookup; a stale one sends them the wrong way and nothing in CI will ever catch it.

## JS patterns

- No `for..in` — use `for..of`.
- No `.forEach(arrow)` — use `for..of`.
- No `console.log`. Console levels: `console.debug` is the verbose-diagnostics level (e.g. WebRTC traces) — it is
  silenced app-wide in production builds at startup (`silenceDebugConsole` from `@/shared/logger`, wired in
  `src/index.tsx`); `console.info` / `warn` / `error` are meaningful output and stay in every build.
- Non-UI files: `function` declarations.
- React components: arrow functions.
- A producer with discrete states exposes **one** `onXChange(status)` callback over a typed union, not several narrow boolean callbacks (`onIdle` + `onError` + …). One callback keeps a single source of truth and lets the producer report every state it owns (including the "active" one a split API tends to omit).
- Do not use manual bytes arrays checks and offsets. use `scale` codecs if it is applicable.

## React

- Function components only, as arrow functions.
- Never the `React` namespace in types — `FC`, not `React.FC`.
- `VoidFunction` over `() => void`.
- `PropsWithChildren<{}>` over manual `type Props = { children: ReactNode }`.
- No inline values in `Context.Provider value={...}` — memoize.
- No curly braces around string literals in JSX props/children.

# Tailwind

- Avoid using px units in Tailwind classes, use default grid values instead.
- All tailwind classes outside JSX must be wrapped in `cnTw` call for correct ordering and parsing.
- Do not extract Tailwind classes into a variable or a shared constant.
- Reuse UI by composing components, never by sharing pieces of another component's implementation. A repeated look is a component that wants extracting: give it a name, props, and a single owner, then use it in both places. Copying its class string, importing its class constant, or passing a `className` that reproduces it spreads one visual decision across files that nothing keeps in sync.

## i18n

- No string literals in JSX. Use `react-intl`. Stories and tests are exempt.

## Feature / Resource conventions

- Feature names: `domain/feature`.
- Resources use the builder pattern ending in `.build()`, and every one declares a `.mock(fn)` (`project-structure.md` § Domain, `resource.ts`).
- `immer`'s `produce` only for nested immutable updates — not for flat objects.
- Slots define extension points for feature UI injection (see `di.md`).
