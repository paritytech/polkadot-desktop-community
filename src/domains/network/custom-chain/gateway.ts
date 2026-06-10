import { createClient } from '@polkadot-api/substrate-client';
import { getWsProvider } from '@polkadot-api/ws-provider';
import * as v from 'valibot';

import { genesisHash } from '../chain/schemas';

import { type DiscoveredChain } from './types';

const DISCOVERY_TIMEOUT_MS = 10_000;

async function discoverChain(endpoint: string): Promise<DiscoveredChain> {
  const client = createClient(getWsProvider(endpoint));

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Connection timeout')), DISCOVERY_TIMEOUT_MS),
  );

  try {
    const [genesisRaw, nameRaw] = await Promise.race([
      Promise.all([client.request<unknown>('chain_getBlockHash', [0]), client.request<unknown>('system_chain', [])]),
      timeout,
    ]);
    return {
      genesisHash: v.parse(genesisHash, genesisRaw),
      name: v.parse(v.pipe(v.string(), v.minLength(1)), nameRaw),
    };
  } finally {
    client.destroy();
  }
}

export const customChainGateway = {
  discoverChain,
};
