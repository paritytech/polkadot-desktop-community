import { type JsonRpcProvider, type PolkadotClient } from 'polkadot-api';

import { type RestartableJsonRpcProvider } from './createRestartableProvider';

export type ChainConfig = {
  genesisHash: string;
};

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export type BranchedProvider = {
  branch(onHalt?: VoidFunction): JsonRpcProvider;
};

export type PooledClient = {
  client: PolkadotClient;
  provider: BranchedProvider;
  rootProvider: RestartableJsonRpcProvider;
};
