import * as v from 'valibot';

import { type HexString, hexString } from '@/shared/types';

// Lowercase so dedup/lookups aren't case-sensitive (a custom-chain RPC node may
// emit uppercase hex).
export const genesisHash = v.pipe(
  hexString,
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- toLowerCase widens `0x${string}` to string; re-narrow for the brand
  v.transform(value => value.toLowerCase() as HexString),
  v.brand('GenesisHash'),
);

export const localAssetId = v.pipe(v.number(), v.brand('LocalAssetId'));

export const chainAssetId = v.pipe(hexString, v.brand('ChainAssetId'));

// chains_v2 catalog — deliberately permissive (`looseObject`): validates only the
// structural fields the transform needs, passing the rest through. `chainId` is a
// label or a bare genesis hash; `genesisHash` is the hash without `0x` (empty for
// mainnet entries that put it in `chainId`); `externalApi.hop` is the bulletin HOP list.
const remoteChainAssetSchema = v.looseObject({
  assetId: v.number(),
  symbol: v.string(),
  precision: v.number(),
  name: v.optional(v.nullable(v.string())),
  priceId: v.optional(v.string()),
  type: v.optional(v.nullable(v.string())),
  typeExtras: v.optional(v.nullable(v.looseObject({}))),
  icon: v.optional(v.string()),
});

export const remoteChainSchema = v.looseObject({
  chainId: v.pipe(v.string(), v.nonEmpty()),
  genesisHash: v.optional(v.string()),
  parentId: v.optional(v.nullable(v.string())),
  name: v.pipe(v.string(), v.nonEmpty()),
  addressPrefix: v.number(),
  nodes: v.array(v.looseObject({ url: v.pipe(v.string(), v.nonEmpty()), name: v.string() })),
  assets: v.optional(v.array(remoteChainAssetSchema), []),
  options: v.optional(v.array(v.string())),
  externalApi: v.optional(v.nullable(v.looseObject({ hop: v.optional(v.array(v.string())) }))),
});

export const remoteChainsSchema = v.array(remoteChainSchema);

export type RemoteChain = v.InferOutput<typeof remoteChainSchema>;
