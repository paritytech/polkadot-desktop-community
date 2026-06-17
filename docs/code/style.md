# Code style

Most rules below are enforced by ESLint (`eslint.config.js`) — `npm run lint` to check, `npm run lint:fix` to auto-fix.

## Files and tests

- Source: camelCase (`createQueryResource.ts`). React components: PascalCase (`HomeButton.tsx`).
- Unit tests co-located as `*.spec.ts`.
- DOM/React tests co-located as `*.test.tsx`, using `@testing-library/react` with `happy-dom`.

## Imports

- Use the `@/` alias for `src/` — relative imports across layers are forbidden.
- Inline type imports: `import { type Foo } from '...'` — never a separate `import type` line.
- Remove unused imports/variables; prefix intentionally unused args with `_`.
- Max **25** module imports per file (type imports excluded).

## TypeScript

- Use `type`, not `interface`. 
- No classes.
- String-literal enums.
- No `as` assertions in production code. If unavoidable, disable the rule on that line with a justification. Tests and `**/mocks/*.ts` are exempt.
- Array type: `T[]`, not `Array<T>`.
- Use the global `Nullable<T>` / `NullableMap<T>` from `src/shared/types/`.
- DI identifiers follow `local-rules/enforce-di-naming-convention` (see `di.md`).

## JS patterns

- No `for..in` — use `for..of`.
- No `.forEach(arrow)` — use `for..of`.
- No `console.log`. Console levels: `console.debug` is the verbose-diagnostics level (e.g. WebRTC traces) — it is
  silenced app-wide in production builds at startup (`silenceDebugConsole` from `@/shared/logger`, wired in
  `src/index.tsx`); `console.info` / `warn` / `error` are meaningful output and stay in every build.
- Non-UI files: `function` declarations.
- React components: arrow functions.

## React

- Function components only, as arrow functions.
- Never the `React` namespace in types — `FC`, not `React.FC`.
- `VoidFunction` over `() => void`.
- `PropsWithChildren<{}>` over manual `type Props = { children: ReactNode }`.
- No inline values in `Context.Provider value={...}` — memoize.
- No curly braces around string literals in JSX props/children.
- All tailwind classes outside JSX must be wrapped in `cnTw` call for correct ordering and parsing.

## i18n

- No string literals in JSX. Use `react-intl`. Stories and tests are exempt.

## Feature / Resource conventions

- Feature names: `domain/feature`.
- Resources use the builder pattern ending in `.build()`.
- `immer`'s `produce` only for nested immutable updates — not for flat objects.
- Slots define extension points for feature UI injection (see `di.md`).
