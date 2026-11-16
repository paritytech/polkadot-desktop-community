import { type PolkadotClient, type TypedApi } from 'polkadot-api';

import { type Descriptors } from './constants';

export type { ConnectionStatus } from '@/shared/chain-connection';

type AppDescriptor = Descriptors[keyof Descriptors];

export type ChainApi = TypedApi<AppDescriptor, false>;

export type ChainStaticApi = Awaited<ReturnType<ChainApi['getStaticApis']>>;

export type TypedClient = {
  client: PolkadotClient;
  api: ChainApi;
  staticApi: ChainStaticApi;
};
