import { type InferOutput } from 'valibot';

import { type GenesisHash } from '../chain/types';

import { type customChainEntrySchema } from './schemas';

export type CustomChainEntry = InferOutput<typeof customChainEntrySchema>;
export type CustomChainsRecord = Record<GenesisHash, CustomChainEntry>;
export type DiscoveredChain = {
  genesisHash: GenesisHash;
  name: string;
};
