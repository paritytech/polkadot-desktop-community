# Environment

## Vocabulary

- **Environment** — a named, end-to-end deployment of the Polkadot product stack: a People chain (statement-store), a Bulletin
  chain (preimage + HOP file relay), an Asset Hub hosting the dotNS contracts, and the identity backend that drives push
  notifications. One environment is active at a time.
- **Channel / EnvironmentId** — string discriminator persisted in `localStorage` under `pb:settings.environmentId`, and the value
  set as the Firebase Remote Config `environment` custom signal to select a channel. Current values: `nightly`, `unstable`
  (console conditions "Common &lt;value&gt; - signal"). The picker (onboarding/settings) switches between these.
- **Stack** — the signed Trinity stack descriptor a channel runs, bundled at build time in `.trinity/`; the TrUAPI core takes
  its chains from it.

## Scope

This domain owns:

- the `Environment` shape (`types.ts`) and its assembly from Remote Config (`resource.ts`, cached per environment id + chain
  catalog digest), composed with the chain catalog by `$usecase/environment.ts` (`getActive()` / `getById()`);
- the channel's bundled stack, carried on the `Environment` (`stack`);
- the small set of config Remote Config does NOT serve, kept in code (`constants.ts`): `hostChatNetwork`,
  `iosBundleId`, `digitalDollarAsset`, plus `CHANNEL_CHAIN_ROLES` — the Android-style role map naming which `chains_v2` entry is
  the people / bulletin / assetHub chain per channel;
- the `dot_ns_config` schema (`schemas.ts`);
- reading the currently active channel id from `localStorage`;
- the persistence key shared with the `network-settings` aggregate.

Switching channels is the responsibility of the `network-settings` aggregate (writes the id via RxState) and the
onboarding/settings UI (triggers a hard reload). The domain itself is stateless — `getActiveId()` re-reads `localStorage` on every
call.

## Boundaries

- No in-memory state, no observables: state belongs to the `network-settings` aggregate.
- **Config is sourced from Firebase Remote Config — no bundled fallback for it.** Chains (`chains_v2`), `dot_ns_config`,
  `ipfs_gateway_url`, and `identity_backend_url` are read through `@/domains/remote-config`; `environmentResource` assembles them
  and throws if Remote Config has not delivered a usable set. The chain catalog is **not** fetched by the resource — it arrives
  as a parameter, resolved from `@/domains/network`'s `chainResource` by `$usecase/environment.ts`, because a resource reads
  leaves and parameters only. The catalog is part of the cache key, so a refreshed catalog re-assembles rather than serving a
  stale environment. The app's
  async bootstrap awaits the first fetch before any config read, so the assembly only runs once values are available. There is no
  static registry of the chain catalog and no offline path — a build without Firebase credentials (e.g. CI/e2e) has no config.
  What a build does bundle is each channel's signed Trinity stack, which the TrUAPI core takes its chains from. A channel's
  Remote Config role chains (people, bulletin, assetHub) must have the same genesis hashes as the chains in its stack: the core
  dials only the stack's chains, and the host's `chain.connect` rejects a genesis hash its registry does not serve. Nothing
  enforces this, so the two sources must be kept in step by hand.
- The `Chain` objects exposed here are produced by `chainService.fromRemoteChains` (genesis-hash–keyed, like the rest of
  `@/domains/network`); `specName` is not used.
