import * as v from 'valibot';

// --- `dot_ns_config` (Remote Config) ---
// dotNS contract addresses, stored as 20-byte hex WITHOUT a `0x` prefix (the
// assembly prepends `0x`).
export const dotNsConfigSchema = v.object({
  resolverContractAddress: v.pipe(v.string(), v.regex(/^(0x)?[0-9a-fA-F]{40}$/)),
  registryContractAddress: v.pipe(v.string(), v.regex(/^(0x)?[0-9a-fA-F]{40}$/)),
});

// --- `VITE_ENVIRONMENTS` (build-time env var) ---
// Channel catalog (values Remote Config doesn't serve), as JSON so no environment
// names live in code. Channels may inherit a top-level `shared` block, merged in
// and validated by `config.ts`.

const nonEmptyString = v.pipe(v.string(), v.nonEmpty());

// Digital-dollar token (e.g. pUSD) coinage payments are denominated in.
const digitalDollarAssetSchema = v.object({
  assetId: v.number(),
  symbol: nonEmptyString,
  precision: v.number(),
  palletName: nonEmptyString,
});

export type DigitalDollarAsset = v.InferOutput<typeof digitalDollarAssetSchema>;

// Fields a channel may inherit from the catalog's `shared` block.
const channelDefaultsSchema = v.object({
  // Network identifier the signing bot accepts in its `network` HTTP parameter.
  botNetwork: nonEmptyString,
  // Network identifier the host-chat SDK's `createAccountService` accepts.
  hostChatNetwork: nonEmptyString,
  iosBundleId: nonEmptyString,
  digitalDollarAsset: digitalDollarAssetSchema,
});

// A fully-resolved channel (after `shared` defaults are merged in).
export const channelConfigSchema = v.object({
  name: nonEmptyString,
  // chains_v2 entry labels for each chain role.
  roles: v.object({ people: nonEmptyString, bulletin: nonEmptyString, assetHub: nonEmptyString }),
  ...channelDefaultsSchema.entries,
});

export type ChannelConfig = v.InferOutput<typeof channelConfigSchema>;

// Raw env shape: a `shared` defaults block + thin channels that may omit any
// inherited field. The merged-then-validated result is `EnvironmentsConfig`.
const sharedDefaultsSchema = v.partial(channelDefaultsSchema);
export const rawEnvironmentsConfigSchema = v.object({
  // Channel id selected when none is persisted; must be a key of `channels`.
  default: nonEmptyString,
  shared: v.optional(sharedDefaultsSchema, {}),
  channels: v.record(
    v.string(),
    v.object({ name: nonEmptyString, roles: channelConfigSchema.entries.roles, ...sharedDefaultsSchema.entries }),
  ),
});

// Resolved catalog consumers see (every channel fully populated).
export type EnvironmentsConfig = { default: string; channels: Record<string, ChannelConfig> };
