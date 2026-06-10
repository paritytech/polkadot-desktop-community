# Domain development flow

How to evolve a domain when a new user scenario appears. The rules live in [project-structure.md](./project-structure.md); this doc covers the *sequence*.

## Principle

Before touching a feature, make sure its user action can be expressed as an atomic call to a domain. If it can't — extend the domain first, **in isolation**, then build the feature on top. Separates "can the system do it?" from "how does the user trigger it?"; the affected area stays narrow, work parallelises, tests catch a class of bugs before any UI exists.

## Flow

1. **Describe the user action in domain terms.** One sentence in the domain's vocabulary ("mark a chain as favorite", "enrich a product manifest with permissions"). If you can't phrase it cleanly, the model needs work — see [when to split a module](#when-to-split-a-module).

2. **Check the domain's public API.** Open `index.ts`. If an existing use case / service / hook covers the action → jump to step 6.

3. **Pick the placement** using the [decision framework](./code-placement.md). Three sub-decisions:
   - **Layer**: domain vs aggregate vs feature — answered by the framework's *Which layer?* table.
   - **File within the domain**: service / resource / `$usecase/` / etc. — answered by the framework's *Which file (per layer)?* table and the [cut rules](./code-placement.md#cut-rules).
   - **New vocabulary**: see [when to split a module](#when-to-split-a-module).

4. **Extend the domain in isolation.** Add the missing files per the [file contracts](./project-structure.md#domain). Cross-domain consumption goes through the other domain's services, use cases, or hooks — never its resources or repositories. Domain → domain dependencies are allowed; the reverse is not.

5. **Keep the API minimal.** Export only what consumers need from the domain `index.ts`.

6. **Cover with tests.** Co-located `*.spec.ts`. Services are pure — assert inputs/outputs. Resources via their public hook or by driving the underlying observable with fakes. Domain-level coverage pays off most.

7. **Build the feature.** In `src/features/{feature}/`, call domain hooks from UI and dispatch use cases on user events (via their hooks for React-state-aware call sites, or directly via the group object when no UI feedback is needed). Domain services may be imported directly. See [feature-development.md](./feature-development.md) and [di.md](./di.md).

## Checklist before merging

- [ ] New behavior reachable through the domain's `index.ts` — no deep imports.
- [ ] Modules are either leaves or containers per [module recursion](./project-structure.md#module-recursion).
- [ ] Domain has an up-to-date `README.md` — structured per [`docs/template/DOMAIN_README.md`](../template/DOMAIN_README.md); external links live there.
- [ ] Every artifact respects its [cut rule](./code-placement.md#cut-rules) — service ≠ use case ≠ resource.
- [ ] Each `$usecase/{group}.ts` exports one `${groupName}UseCase` object with `<verb><Noun>` method names; co-located `{group}.hooks.ts` provides one `use<VerbNoun>` per public method.
- [ ] Use case I/O reuses module/domain types. No React/UI/Electron/IPC types in `$usecase/`.
- [ ] DI side-effect identifiers live at the top of the use case file and are re-exported from `index.ts`.
- [ ] Cached/persisted data lives in resources/Dexie; runtime selection state is in an aggregate, not the domain.
- [ ] Every resource and mutation function has a matching `useX` hook in `hooks.ts`. `hooks.ts` contains no UI or feature-local hooks.
- [ ] Features consume domain reads only via the named hooks (no `createQueryResource`, no inline `useRead`).
- [ ] Cross-domain consumption goes through services / use cases / hooks of the other domain.
- [ ] Co-located `*.spec.ts` on domain changes.
- [ ] No [anti-patterns](./project-structure.md#anti-patterns).

## When to split a module

A module's `service.ts` is starting to mix two vocabularies. Three moves, in order of locality:

1. **Nest** — new vocabulary still belongs *inside* the parent's concept (e.g. `permissions/` accumulates alias-management AND scope-evaluation; both are "permissions"). Convert the module into a container with sub-modules.
2. **Sibling module** — new vocabulary belongs to the same domain but is no longer the parent's concept. Move to a sibling under the domain root.
3. **New domain** — new vocabulary is independent and other domains will consume it on its own terms (e.g. "chain" in `networks` drifting into "staking"). Promote; the old domain may depend on the new, never the reverse.

Spot the seam with [event storming](../abstract/event-storming.md). Trigger: `service.ts` mixing two vocabularies, or step 1 above not phrasable in one sentence.

## Examples

```typescript
// Resource — single-source read with caching
export const chainResource = createQueryResource<Params>({ key: (p) => [p.first, p.second] })
  .request<ResponseType>(service.fetchData)
  .retry({ delay: 500, count: 3 })
  .cache<CacheType>({ initial: {}, staleAfter: 10_000, map: (cache, response, params) => produce(cache, draft => { /* ... */ }) })
  .build();

// Stream resource
export const eventsResource = createStreamResource<Params>({ key: (p) => p.id })
  .subscribe<ResponseType>((p) => new Observable(subscriber => { /* ... */ }))
  .cache<CacheType>({ initial: {}, map: (cache, message, params) => produce(cache, draft => { /* ... */ }) })
  .build();

// Mutation — plain Observable-returning function
export function sendMessage(params: SendMessageParams): Observable<void> {
  return sendMessage$(params).pipe(take(1));
}
```

```typescript
// hooks.ts — named domain entry points
export const useChains = (params: NullableMap<ChainParams>) => useRead(chainResource, {
  params: nonNullableMap(params) ? params : null,
  defaultValue: [],
  map: (cache, p) => cache[p.version]?.[p.file],
});

export const useSendMessage = () => useAction(sendMessage);
```

```tsx
// Feature consumes the named hooks — never useRead/useAction inline
export const Component = () => {
  const { data: chains, pending } = useChains({ version: 1 });
  if (pending) return <Loading/>;
  return <Chains chains={chains}/>;
};

export const SendButton = () => {
  const { run: sendMessage, pending } = useSendMessage();
  return <Button disabled={pending} onClick={() => sendMessage({ conversationId })}>Send</Button>;
};
```
