# remote-config

The `remote-config` domain owns the renderer's connection to **Firebase Remote Config**: initializing the client, selecting a channel via a custom signal, fetching + activating the server-side parameter set, and exposing a small typed read API over the activated values. It is the single seam through which the app reads remotely-served configuration (the chain catalog, dotNS contract addresses, the IPFS gateway URL, the identity-backend URL).

It is deliberately a **transport** layer, not a config-modelling one: it knows *how* to reach Remote Config and *how* to read a raw parameter safely (parse + validate at the trust boundary), nothing about what any parameter means. It ships **no defaults** — a value the server has not provided reads as `null`, and the consumer decides what that means. It is also **environment-agnostic**: it never names a channel; the set of channels lives in `VITE_ENVIRONMENTS`, owned by the `application` domain.

## Vocabulary

- **Parameter** — one server-side key/value entry. Keys are the canonical strings in `REMOTE_CONFIG_KEYS` (`chains_v2`, `dot_ns_config`, `ipfs_gateway_url`, `identity_backend_url`). Values are JSON-encoded (`tryGetJson`) or raw strings (`tryGetString`).
- **Channel** — a named variant of the parameter set. The web client selects one by setting the **custom signal** `environment` to the channel id; the server resolves the matching console condition (`Common <id> - signal`) and serves its conditional values. The id is an opaque string owned by the `application` domain — this domain never enumerates valid ids.
- **Custom signal** — the only client-controllable input to RC's server-side condition evaluation (`REMOTE_CONFIG_SIGNAL_KEY = 'environment'`). Applied via `setCustomSignals` **before** the fetch. (The app-gated Android conditions are unreachable from web; the custom signal is how web reaches a channel.)
- **Activation** — reads are synchronous against the SDK's last-*activated* snapshot (persisted in IndexedDB). `fetchAndActivate` pulls fresh values and activates them for the next read; a read before the first activation sees nothing.
- **Readiness** — `remoteConfigReady`, a promise that resolves once the first fetch/activate settles (success **or** failure). It never rejects — a failed fetch is not a caller error. Consumers that need a fresh read `await` it before calling `tryGet*`.

## Scope

This domain owns:

- **Client lifecycle** — initializing the Firebase app + RC instance once (`bootstrapRemoteConfig`), applying throttle/timeout settings, guarding against double-init.
- **Channel selection** — translating an app-supplied channel id into the `environment` custom signal, applied before fetch.
- **Fetch + activate orchestration** — a best-effort, fire-and-forget `setCustomSignals → fetchAndActivate` chain that resolves `remoteConfigReady` when it settles.
- **Safe typed reads** — `remoteConfigGateway.tryGetJson` / `tryGetString`: read a raw parameter, JSON-parse where applicable, validate through a caller-supplied Valibot schema (the trust boundary), and return `null` on missing/invalid.
- **The Firebase-credential trust boundary** — `firebaseConfigSchema` rejects a missing/blank `VITE_FIREBASE_*` config; RC then stays disabled and every read returns `null`.

## Flow — bootstrapping and reading

1. **Bootstrap once** from the app boundary: `bootstrapRemoteConfig({ apiKey, projectId, appId, environment?, minimumFetchIntervalMillis? })` validates credentials, creates the client, applies the channel signal, and kicks off `fetchAndActivate`. Fire-and-forget — completion is observable via `remoteConfigReady`. Called exactly once from `src/bootstrap.ts`, never at import time.
2. **Await readiness** before the first read (`await remoteConfigReady`) so consumers read an activated snapshot, not an empty one.
3. **Read** via `remoteConfigGateway.tryGetJson` / `tryGetString`. `null` means "not provided"; the consumer decides — the `application` Environment assembly throws (config is required), the chain resource falls back to `[]` with a call-site `?? []` (an *absence* marker, not bundled data).

Rule of thumb: every read takes a Valibot schema and returns the validated value or `null`. The schema — not this domain — defines the value's shape; this domain only guarantees the value matches it or is rejected. Want a default? Apply `?? fallback` at the call site.

## Boundaries

This domain does **not** own:

- **What any parameter means.** Transforming `chains_v2` into `Chain[]`, interpreting `dot_ns_config`, etc. lives in the consuming domains (`network`, `application`); this domain returns validated raw shapes.
- **Channel definitions / environment knowledge.** Channel ids, names, and per-channel values live in `VITE_ENVIRONMENTS` and the `application` domain. This domain takes a channel id as an opaque string.
- **Defaults / fallbacks.** There are none here — a missing value is `null`; any default is the caller's `?? fallback`.
- **Persistence of the parsed result.** The SDK persists the last-activated snapshot; caching the *parsed* result is the consumer's concern (e.g. a resource cache).
- **App-config injection.** Reading `VITE_FIREBASE_*` / `VITE_ENVIRONMENTS` happens at the app boundary / `application` domain; credentials arrive here as plain parameters.

## References

- [Firebase Remote Config — Web SDK](https://firebase.google.com/docs/remote-config/get-started?platform=web) — `getRemoteConfig`, `fetchAndActivate`, `getValue`, `setCustomSignals`.
- [RC custom signals](https://firebase.google.com/docs/remote-config/parameters#custom_signal_conditions) — the `environment` signal → console-condition mechanism used for channel selection.
- [`firebase`](https://www.npmjs.com/package/firebase), [`valibot`](https://valibot.dev/) — the SDK this domain wraps and the schema validator applied at every read.
- Consumers: `src/bootstrap.ts` (the sole `bootstrapRemoteConfig` caller), `src/domains/application/$usecase/environment.ts` and `src/domains/network/chain/resource.ts` (the two `remoteConfigGateway` consumers).
