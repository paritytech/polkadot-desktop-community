import { type Chain, type GenesisHash } from '../chain/types';

import { type CustomChainEntry } from './types';

function buildChain(genesisHash: GenesisHash, entry: CustomChainEntry): Chain {
  return {
    chainId: genesisHash,
    genesisHash,
    name: entry.name,
    assets: [],
    nodes: entry.endpoints.map(url => ({ url, name: entry.name })),
    addressPrefix: 42,
  };
}

export const customChainService = {
  buildChain,
};
