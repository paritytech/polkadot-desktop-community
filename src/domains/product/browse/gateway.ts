import { type AppListing } from '@parity/browse-sdk';
import { createBrowseSdk, isKnownGenesis, selectNetwork } from '@parity/browse-sdk';
import { getWsProvider } from '@polkadot-api/ws-provider';

import { environmentUseCase } from '@/domains/application';

async function listPublishedWidgets(): Promise<AppListing[]> {
  const env = await environmentUseCase.getActive();
  const genesis = env.dotnsChain.genesisHash;

  if (!isKnownGenesis(genesis)) {
    return [];
  }

  const network = selectNetwork(genesis);
  const rpcUrl = network.rpcs[0];
  if (!rpcUrl) {
    return [];
  }

  const provider = getWsProvider(rpcUrl);
  const sdk = createBrowseSdk(network, provider);

  try {
    return await sdk.listAppsByModality('widget');
  } finally {
    sdk.destroy();
  }
}

export const browseGateway = {
  listPublishedWidgets,
};
