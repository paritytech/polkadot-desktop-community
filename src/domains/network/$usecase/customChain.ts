import { firstValueFrom } from 'rxjs';

import { getChains } from '../chain/resource';
import { type GenesisHash } from '../chain/types';
import { customChainGateway } from '../custom-chain/gateway';
import { addCustomChain, customChainsResource } from '../custom-chain/resource';

export type AddCustomChainResult =
  | { status: 'added'; name: string; genesisHash: GenesisHash }
  | { status: 'duplicate-builtin' }
  | { status: 'duplicate-custom' }
  | { status: 'failed'; message: string };

// Discover a Substrate endpoint, reject it if its genesis already belongs to a
// curated or custom chain, then persist it. Composes the discovery gateway, the
// builtin + custom chain reads, and the persistence mutation — a single source
// of truth for "can this endpoint be added", returned as a result the caller
// maps to UI feedback.
async function discoverAndAddChain(endpoint: string, name: string): Promise<AddCustomChainResult> {
  let discovered;
  try {
    discovered = await customChainGateway.discoverChain(endpoint);
  } catch (error) {
    return { status: 'failed', message: error instanceof Error ? error.message : '' };
  }

  const builtinChains = await getChains();
  if (builtinChains.some(chain => chain.genesisHash === discovered.genesisHash)) {
    return { status: 'duplicate-builtin' };
  }

  const customChains = await firstValueFrom(customChainsResource.read$({}));
  if (customChains[discovered.genesisHash]) {
    return { status: 'duplicate-custom' };
  }

  const displayName = name.trim() || discovered.name;
  await firstValueFrom(addCustomChain({ chainId: discovered.genesisHash, entry: { name: displayName, endpoints: [endpoint] } }));

  return { status: 'added', name: displayName, genesisHash: discovered.genesisHash };
}

export const customChainUseCase = {
  discoverAndAddChain,
};
