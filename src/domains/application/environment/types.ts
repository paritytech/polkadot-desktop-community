import { type HexString } from '@novasamatech/scale';

import { type Chain } from '@/domains/network';

import { type DigitalDollarAsset } from './schemas';

// A channel id from the `VITE_ENVIRONMENTS` catalog. The set of valid ids is
// build-time config, not a code-level union — the code carries no channel names.
export type EnvironmentId = string;

// A signed Trinity stack bundled in `.trinity/`. The descriptor holds the bytes of the copy as served, because the core
// checks the signature over those bytes; it is never parsed and re-encoded.
export type BundledStack = { pointer: string; descriptor: Uint8Array };

// The active environment: code-side config (from `VITE_ENVIRONMENTS`) merged with
// dynamic config (chains/ipfs/dotNS/identity) assembled from Remote Config.
export type Environment = {
  id: EnvironmentId;
  // Display name from the channel catalog.
  name: string;

  peopleChain: Chain;
  bulletinChain: Chain;

  // Must be a single-node WS URL — the HOP pool is per-node and load-balanced URLs
  // cause cross-node lookup misses.
  bulletinHopEndpoints: string[];

  dotnsChain: Chain;
  dotnsContentResolverContract: HexString;
  // Registry contract address: the manifest-based resolver reads `resolver(node)`
  // and `owner(node)` from here. Distinct from the content resolver, which holds
  // the text records.
  dotnsRegistryContract: HexString;

  // Root of the identity-backend; consumers append paths like `/api/v1/notify`.
  backendUrl: string;
  iosBundleId: string;
  ipfsGatewayUrl: string;

  // Network identifier the host-chat SDK's `createAccountService` accepts.
  hostChatNetwork: string;

  digitalDollarAsset: DigitalDollarAsset;
};

export type { DigitalDollarAsset };
