import * as v from 'valibot';

import { genesisHash } from './schemas';
import { type ChainOptions, type GenesisHash } from './types';

// Runtime source of truth for the `ChainOptions` union — used to filter the
// untyped chains_v2 `options` strings down to the values we model. `satisfies`
// keeps it in sync with the type (a typo or stray value fails to compile).
export const CHAIN_OPTIONS = [
  'testnet',
  'governance',
  'multisig',
  'regular_proxy',
  'pure_proxy',
  'ethereum_based',
] as const satisfies readonly ChainOptions[];

// Well-known public relay-chain genesis hashes — for chain-list sorting (group
// parachains under their relay) and light-client routing. NOT environment config.
export const WellKnownChains = {
  polkadotRelay: v.parse(genesisHash, '0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3'),
  kusamaRelay: v.parse(genesisHash, '0xb0a8d493285c2df73290dfb7e61f870f17b41801197a149ca93654499ea3dafe'),
  westendRelay: v.parse(genesisHash, '0xe143f23803ac50e8f6f8e62695d1ce9e4e1d68aa36c1cd2cfd15340213f3423e'),
  paseoRelay: v.parse(genesisHash, '0x77afd6190f1554ad45fd0d31aee62aacc33c6db0ea801129acb813f913e0764f'),
} satisfies Record<string, GenesisHash>;
