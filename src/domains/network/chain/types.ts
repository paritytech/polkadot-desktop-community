import { type InferOutput } from 'valibot';

import { type chainAssetId, type genesisHash, type localAssetId } from './schemas';

// asset

export type LocalAssetId = InferOutput<typeof localAssetId>;
export type ChainAssetId = InferOutput<typeof chainAssetId>;
export type AssetType = 'native' | 'orml' | 'statemine';

export type Asset = {
  name: string;
  assetId: LocalAssetId;
  symbol: string;
  staking?: StakingType;
  precision: number;
  priceId?: string;
  type: AssetType;
  typeExtras?: StatemineExtras | OrmlExtras;
  icon: {
    monochrome: string;
    colored: string;
  };
};

export type StakingType = 'relaychain';

export type StatemineExtras = {
  assetId: ChainAssetId;
  palletName?: string;
};

export type OrmlExtras = {
  currencyIdScale: ChainAssetId;
  currencyIdType: string;
  existentialDeposit: string;
  transfersEnabled?: boolean;
};

export type AssetLocation =
  | {
      type: 'native';
    }
  | {
      type: 'orml';
      currencyIdScale: ChainAssetId;
      currencyIdType: string;
    }
  | {
      type: 'statemine';
      assetId: ChainAssetId;
      palletName: string;
    };

// chain

export type GenesisHash = InferOutput<typeof genesisHash>;

export type Chain = {
  chainId: string;
  genesisHash: GenesisHash;
  parentId?: GenesisHash;
  name: string;
  assets: Asset[];
  nodes: RpcNode[];
  explorers?: Explorer[];
  addressPrefix: number;
  externalApi?: Partial<Record<'hop', string[]>>;
  options?: ChainOptions[];
  additional?: ChainAdditional;
};

export type ChainAdditional = {
  identityChain: GenesisHash;
  timelineChain: GenesisHash;

  // Supports metadata proofs
  supportsGenericLedgerApp: boolean;
};

export type ChainOptions = 'testnet' | 'governance' | 'multisig' | 'regular_proxy' | 'pure_proxy' | 'ethereum_based';

export type RpcNode = {
  url: string;
  name: string;
};

export type Explorer = {
  name: string;
  extrinsic?: string;
  account?: string;
  event?: string;
  multisig?: string;
};
