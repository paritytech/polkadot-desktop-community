# Environment

## Vocabulary

- **Environment** — a named, end-to-end deployment of the Polkadot product stack: a People chain (statement-store), a Bulletin
  chain (preimage + HOP file relay), an Asset Hub hosting the dotNS contracts, and the identity backend that drives push
  notifications. One environment is active at a time.
- **Channel / EnvironmentId** — string discriminator persisted in `localStorage` under `pb:settings.environmentId`, and the value
  set as the Firebase Remote Config `environment` custom signal to select a channel. Current values: `nightly`, `unstable`
  (console conditions "Common &lt;value&gt; - signal"). The picker (onboarding/settings) switches between these.

## Scope

This domain owns:

- the `Environment` shape (`types.ts`) and its assembly from Remote Config (`service.ts` `getActive()`/`getById()`);
- the small set of config Remote Config does NOT serve, kept in code (`constants.ts`): `botNetwork`, `hostChatNetwork`,
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
- **Config is sourced from Firebase Remote Config — no bundled fallback.** Chains (`chains_v2`), `dot_ns_config`,
  `ipfs_gateway_url`, and `identity_backend_url` are read through `@/domains/remote-config`; `getActive()` assembles them (chains
  via the `@/domains/network` transform + the role map) and throws if Remote Config has not delivered a usable set. The app's
  async bootstrap awaits the first fetch before any config read, so the assembly only runs once values are available. There is no
  static registry and no offline path — a build without Firebase credentials (e.g. CI/e2e) has no config.
- The `Chain` objects exposed here are produced by `chainService.fromRemoteChains` (genesis-hash–keyed, like the rest of
  `@/domains/network`); `specName` is not used.
