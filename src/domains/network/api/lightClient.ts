import { type JsonRpcProvider } from '@polkadot-api/json-rpc-provider';
import { getSmProvider } from 'polkadot-api/sm-provider';
import { type Chain as SmoldotChain, type Client as SmoldotClient } from 'polkadot-api/smoldot';

import { WellKnownChains } from '../chain/constants';
import { type GenesisHash } from '../chain/types';

type LightClientChain = {
  chainSpec: () => Promise<string>;
  relayChain?: GenesisHash;
};

const lightClientChains: Partial<Record<GenesisHash, LightClientChain>> = {
  [WellKnownChains.polkadotRelay]: {
    chainSpec: () => import('polkadot-api/chains/polkadot').then(m => m.chainSpec),
  },
  [WellKnownChains.kusamaRelay]: {
    chainSpec: () => import('polkadot-api/chains/kusama').then(m => m.chainSpec),
  },
  [WellKnownChains.westendRelay]: {
    chainSpec: () => import('polkadot-api/chains/westend').then(m => m.chainSpec),
  },
};

let smoldot: SmoldotClient | null = null;

const getSmoldot = async (): Promise<SmoldotClient> => {
  const { start } = await import('polkadot-api/smoldot');
  smoldot ??= start();
  return smoldot;
};

const getSmoldotChain = (chainId: GenesisHash): Promise<SmoldotChain> => {
  const config = lightClientChains[chainId];
  if (!config) {
    return Promise.reject(new Error(`Light client is not configured for chain ${chainId}`));
  }

  const promise = Promise.all([config.chainSpec(), config.relayChain ? getSmoldotChain(config.relayChain) : undefined])
    .then(([chainSpec, relayChain]) => {
      return getSmoldot().then(s =>
        s.addChain({
          chainSpec,
          potentialRelayChains: relayChain ? [relayChain] : undefined,
        }),
      );
    })
    .catch((error: unknown) => {
      throw error;
    });

  return promise;
};

export const hasLightClientSupport = (chainId: GenesisHash): boolean => {
  return chainId in lightClientChains;
};

export const createLightClientProvider = (chainId: GenesisHash): JsonRpcProvider => {
  return getSmProvider(() => getSmoldotChain(chainId));
};
