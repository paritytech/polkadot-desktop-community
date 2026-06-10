# Dependency Injection (DI)

Located in `src/shared/di/`. Enables loose coupling between features.

## Model

This DI is **functional**: containers inject **handlers**, not services or shared state. The consumer owns the data and execution flow; providers contribute behavior (or extra data) that the consumer invokes against its own inputs.

- **Consumers declare extension points** (slots, pipelines, SDK contracts) describing the handler shape and the data they pass in.
- **Providers register handlers** — usually pure functions that take consumer-supplied data and return a result (UI, transformed data, etc.).
- **No service locator, no global lookups.** Providers don't reach for state; they react to what the consumer hands them.

The result: composition without tight coupling. A feature can be extended or reshaped by injecting behavior from another feature, with neither side knowing the other's internals.

## Naming

Identifiers (slots, pipelines, transformers, anyOf, side effects, SDKs) **must be named after the place of use** — the location, extension point, or contract owned by the consumer — never after a specific provider, feature, or handler that happens to inject into it today.

The consumer is the long-lived side: it defines what the extension point means and where it sits. Providers come and go. Naming the identifier after a provider hard-codes a temporary fact (one of the current handlers) into a permanent name, which then misleads every reader and every future provider about what belongs there.

Bad: `favoriteSizeSelectorModalSlot` — the slot lives in `AddressBar`, but it's named after the single handler currently injected. Anyone reading the name assumes the slot is for that one modal; in reality the address bar can host arbitrary right-side controls.

Good: `addressBarRightSlot`, `topBarRightSlot`, `enrichUrlPipeline`, `resolveProductIconTransformer` — each name describes the location or contract of the extension point, leaving providers free to plug in whatever fits.

A practical test: if you removed every current provider, would the name still describe a meaningful extension point? If not, rename it.

## Slots

For dynamic UI content.

```tsx
import { createSlot, Slot } from '@/shared/di';

export const topBarRightSlot = createSlot<Props>({ name: 'topBarRightSlot' });

<Slot id={topBarRightSlot} props={props} />;

feature.inject(topBarRightSlot, (props) => <MyComponent/>);
// or with order:
feature.inject(topBarRightSlot, {
  order: 1,
  render: (props) => <MyComponent/>
});
```

## Pipelines

Sequential data transformation — each handler receives the previous output and returns the next value. Equivalent to `handlers.reduce((value, fn) => fn(value, meta), input)`.

```typescript
import { createPipeline } from '@/shared/di';

export const enrichUrlPipeline = createPipeline<string, { origin: string }>({ name: 'enrichUrl' });

feature.inject(enrichUrlPipeline, (url, meta) => url.replace('{origin}', meta.origin));

const finalUrl = enrichUrlPipeline(rawUrl, { origin });
// In React:
const finalUrl = usePipeline(enrichUrlPipeline, rawUrl, { origin });
```

## Async Pipelines

Same contract as pipelines, but handlers may return `Promise<Value>`. Use when any stage can be async (I/O, awaited validation).

```typescript
import { createAsyncPipeline } from '@/shared/di';

const loadManifestPipeline = createAsyncPipeline<Manifest, { productId: string }>({ name: 'loadManifest' });

feature.inject(loadManifestPipeline, async (manifest, { productId }) => {
  const patch = await fetchPatch(productId);
  return { ...manifest, ...patch };
});

const manifest = await loadManifestPipeline.apply(initial, { productId });
```

## Transformers

Like a pipeline, but returns the **first non-nullable result** instead of threading values through every handler. Input and output types can differ. Ideal for "who can handle this?" lookups.

```tsx
import { createTransformer } from '@/shared/di';

export const resolveProductIconTransformer = createTransformer<Product, ReactNode>({ name: 'resolveProductIcon' });

feature.inject(resolveProductIconTransformer, product => {
  if (product.kind !== 'chat') return null; // fall through
  return <ChatIcon product={product} />;
});

const icon = resolveProductIconTransformer(product); // ReactNode | null
// In React:
const icon = useTransformer(resolveProductIconTransformer, product);
```

## AnyOf

Short-circuiting OR over handlers. Each handler returns `boolean | void`; `check(value)` returns `true` as soon as one handler does. Useful for capability probes.

```typescript
import { createAnyOf } from '@/shared/di';

export const canHandleUrlAnyOf = createAnyOf<URL>({ name: 'canHandleUrl' });

feature.inject(canHandleUrlAnyOf, url => url.protocol === 'dotns:');

const handled = canHandleUrlAnyOf.check(url);
// In React:
const handled = useAnyOf(canHandleUrlAnyOf, url);
```

## SideEffects

Fan-out of fire-and-forget actions. `apply(params)` invokes every handler and returns `Promise<PromiseSettledResult[]>`. Handlers can be sync or async; errors are captured per handler. Optional `filter` drops calls before dispatch.

```typescript
import { createSideEffect } from '@/shared/di';

export const onProductOpenedSideEffect = createSideEffect<{ productId: string }>({ name: 'onProductOpened' });

feature.inject(onProductOpenedSideEffect, async ({ productId }) => {
  await analytics.track('product_opened', { productId });
});

await onProductOpenedSideEffect.apply({ productId });
```

Inside a React component use `useSideEffect` to register a handler scoped to the component's lifecycle — it's removed automatically on unmount, and the callback always sees the latest closure:

```tsx
import { useSideEffect } from '@/shared/di';

const ProductCard = ({ productId, onOpen }: Props) => {
  useSideEffect(onProductOpenedSideEffect, params => {
    if (params.productId !== productId) return;
    onOpen(params);
  });

  return <Card>{/* ... */}</Card>;
};
```

## SDK

Declarative contract bundling multiple identifiers into a single integration entry point. Consumers define required/optional identifiers; providers pass a handler map and the SDK wires each entry via `feature.inject`.

```tsx
import { createSDK } from '@/shared/di';

export const widgetSDK = createSDK({
  required: { contentSlot, headerSlot },
  optional: { footerSlot },
});

widgetSDK(myFeature, {
  contentSlot: () => <Content />,
  headerSlot: () => <Header />,
  footerSlot: () => <Footer />, // optional
});
```

Use an SDK when a feature has several extension points that must be injected together as one coherent integration.

## combineIdentifiers

Merges multiple identifiers of the same kind into one. A handler registered against the combined identifier is forwarded to every underlying identifier. Useful when one handler should serve several extension points.

```typescript
import { combineIdentifiers } from '@/shared/di';

const bothBars = combineIdentifiers(topBarLeftSlot, topBarRightSlot);
feature.inject(bothBars, () => <SharedControl />);
```

## React integration

`@/shared/di` exposes hooks that re-render the consumer when handlers change:

- `<Slot id={...} props={...} />` / `useSlot(slot, { props })`
- `usePipeline(pipeline, value, meta)`
- `useTransformer(transformer, input, meta)`
- `useAnyOf(anyOf, value)`
- `useSideEffect(sideEffect, callback)` — registers `callback` as a handler for the component's lifetime; unregisters on unmount.

To trigger a side effect, call `.apply(...)` directly — `useSideEffect` is for registering handlers, not invoking them.
