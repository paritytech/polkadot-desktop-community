import * as v from 'valibot';

import { assert } from '@/shared/utils';

import { CHAIN_OPTIONS, WellKnownChains } from './constants';
import { type RemoteChain, genesisHash } from './schemas';
import { type Asset, type AssetLocation, type Chain, type ChainOptions, type GenesisHash } from './types';

function sortChains<T extends Pick<Chain, 'name' | 'options' | 'genesisHash' | 'parentId'>>(chains: T[]): T[] {
  const polkadotChains: T[] = [];
  const kusamaChains: T[] = [];
  const otherChains: T[] = [];
  const testnetChains: T[] = [];

  for (const chain of chains) {
    if (chain.genesisHash === WellKnownChains.polkadotRelay) {
      polkadotChains.unshift(chain);
    } else if (chain.genesisHash === WellKnownChains.kusamaRelay) {
      kusamaChains.unshift(chain);
    } else if (chain.parentId === WellKnownChains.polkadotRelay) {
      polkadotChains.push(chain);
    } else if (chain.parentId === WellKnownChains.kusamaRelay) {
      kusamaChains.push(chain);
    } else if (chain.options?.includes('testnet')) {
      testnetChains.push(chain);
    } else {
      otherChains.push(chain);
    }
  }

  function parachainPriority(chain: T, relay: 'polkadot' | 'kusama'): number {
    return chain.name.trim().toLowerCase().startsWith(relay) ? 0 : 1;
  }

  // Relay first, then parachains whose name starts with the relay name, then alphabetical.
  function sortRelayGroup(chains: T[], relayChainId: GenesisHash, relayName: 'polkadot' | 'kusama') {
    chains.sort((a, b) => {
      if (a.genesisHash === relayChainId) return -1;
      if (b.genesisHash === relayChainId) return 1;
      const pa = parachainPriority(a, relayName);
      const pb = parachainPriority(b, relayName);
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name);
    });
  }

  sortRelayGroup(polkadotChains, WellKnownChains.polkadotRelay, 'polkadot');
  sortRelayGroup(kusamaChains, WellKnownChains.kusamaRelay, 'kusama');

  otherChains.sort((a, b) => a.name.localeCompare(b.name));
  testnetChains.sort((a, b) => a.name.localeCompare(b.name));

  return [...polkadotChains, ...kusamaChains, ...otherChains, ...testnetChains];
}

const getNativeAsset = (assets: Asset[]): Asset => {
  const nativeAsset = assets.find(asset => asset.type === 'native');
  if (!nativeAsset) {
    // some networks use orml assets as native (cringe)
    const firstAsset = assets.at(0);
    assert(firstAsset, 'Native asset is not found');
    return firstAsset;
  }

  return nativeAsset;
};

const getAssetLocation = (asset: Asset): AssetLocation => {
  switch (asset.type) {
    case 'native':
      return { type: 'native' };
    case 'statemine': {
      if (asset.typeExtras && 'assetId' in asset.typeExtras) {
        return {
          type: 'statemine',
          assetId: asset.typeExtras.assetId,
          palletName: asset.typeExtras.palletName ?? 'Assets',
        };
      }
      throw new Error('Statemine asset typeExtras is not defined');
    }
    case 'orml': {
      if (asset.typeExtras && 'currencyIdScale' in asset.typeExtras) {
        return {
          type: 'orml',
          currencyIdScale: asset.typeExtras.currencyIdScale,
          currencyIdType: asset.typeExtras.currencyIdType,
        };
      }
      throw new Error('ORML asset typeExtras is not defined');
    }
  }
};

function canInspectSigning(chain: Chain): boolean {
  return chain.assets.length > 0;
}

function isGenesisHex(value: string): boolean {
  return /^(0x)?[0-9a-fA-F]{64}$/.test(value);
}

function toGenesis(value: string | null | undefined): GenesisHash | null {
  if (!value || !isGenesisHex(value)) return null;
  return v.parse(genesisHash, `0x${value.replace(/^0x/i, '')}`);
}

// chains_v2 mainnet entries carry the hash in `chainId`; catalog entries in `genesisHash`.
function effectiveGenesis(entry: RemoteChain): GenesisHash | null {
  return toGenesis(entry.genesisHash) ?? toGenesis(entry.chainId);
}

const CHAIN_OPTION_SET = new Set<string>(CHAIN_OPTIONS);
function isChainOption(value: string): value is ChainOptions {
  return CHAIN_OPTION_SET.has(value);
}

function toAsset(raw: NonNullable<RemoteChain['assets']>[number]): Asset {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- chains_v2 asset ids aren't hex-branded; mirrors chains.json handling
  return {
    name: raw.name ?? raw.symbol,
    assetId: raw.assetId,
    symbol: raw.symbol,
    precision: raw.precision,
    priceId: raw.priceId,
    type: raw.type ?? 'native',
    typeExtras: raw.typeExtras ?? undefined,
    icon: { monochrome: raw.icon ?? '', colored: raw.icon ?? '' },
  } as Asset;
}

function fromRemoteChains(raw: RemoteChain[]): Chain[] {
  const genesisByLabel = new Map<string, GenesisHash>();
  for (const entry of raw) {
    const genesis = effectiveGenesis(entry);
    if (genesis) genesisByLabel.set(entry.chainId, genesis);
  }

  const result: Chain[] = [];
  for (const entry of raw) {
    const genesis = effectiveGenesis(entry);
    if (!genesis) continue;

    const parentGenesis = entry.parentId ? (genesisByLabel.get(entry.parentId) ?? toGenesis(entry.parentId)) : null;
    if (entry.parentId && parentGenesis === null) {
      console.warn(
        `[network] chains_v2 "${entry.chainId}" parentId "${entry.parentId}" has no resolvable genesis — chain ungrouped`,
      );
    }

    result.push({
      chainId: entry.chainId,
      genesisHash: genesis,
      parentId: parentGenesis ?? undefined,
      name: entry.name,
      addressPrefix: entry.addressPrefix,
      nodes: entry.nodes.map(node => ({ url: node.url, name: node.name })),
      assets: (entry.assets ?? []).map(toAsset),
      externalApi: entry.externalApi?.hop ? { hop: entry.externalApi.hop } : undefined,
      options: entry.options?.filter(isChainOption),
    } satisfies Chain);
  }

  return result;
}

function findRemoteChain(chains: Chain[], label: string): Chain | undefined {
  return chains.find(c => c.chainId === label);
}

export const chainService = {
  sortChains,
  getNativeAsset,
  getAssetLocation,
  canInspectSigning,
  fromRemoteChains,
  findRemoteChain,
};
