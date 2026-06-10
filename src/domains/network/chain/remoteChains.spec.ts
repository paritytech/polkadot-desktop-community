import * as v from 'valibot';
import { describe, expect, it, vi } from 'vitest';

import { remoteChainsSchema } from './schemas';
import { chainService } from './service';

// Trimmed synthetic `chains_v2` payload for the `alpha` channel.
const ALPHA_RAW = [
  {
    chainId: 'alpha-relay',
    genesisHash: 'be40bbaf734bbd701441808aeeddc250f7e749fc975a14aff5e3908af02953e5',
    parentId: null,
    name: 'Alpha Relay',
    addressPrefix: 0,
    nodes: [{ url: 'wss://alpha-relay.example/rpc', name: 'RPC' }],
    assets: [],
  },
  {
    chainId: 'alpha-asset-hub',
    genesisHash: 'edf25d35f1434f291af0ba8f41db1676efc3e1402a068d499a844fed203e8e62',
    parentId: 'alpha-relay',
    name: 'Alpha Asset Hub',
    addressPrefix: 0,
    nodes: [{ url: 'wss://alpha-asset-hub.example/rpc', name: 'RPC' }],
    assets: [
      {
        assetId: 1,
        symbol: 'USDT',
        precision: 6,
        priceId: 'tether',
        name: 'Tether USD',
        type: 'statemine',
        typeExtras: { assetId: '1984', isSufficient: true },
      },
      {
        assetId: 2,
        symbol: 'USDC',
        precision: 6,
        type: 'statemine',
        icon: 'https://example.test/USDC.svg',
        typeExtras: { assetId: '1337' },
      },
    ],
  },
  {
    chainId: 'alpha-people',
    genesisHash: '107c56fe0f4792238395e7d582c571f59cf3f565a154a6fa26394d418bea1b3f',
    parentId: 'alpha-relay',
    name: 'Alpha People',
    addressPrefix: 42,
    nodes: [{ url: 'wss://alpha-people.example/rpc', name: 'RPC' }],
    assets: [{ assetId: 0, symbol: 'PAS', precision: 10, priceId: 'polkadot', name: null, type: null, typeExtras: null }],
  },
  {
    chainId: 'alpha-bulletin',
    genesisHash: '5834e1351afe7f3954319a71012ae70e852ddade3ab59835ae68a3394d6731a9',
    parentId: 'alpha-relay',
    name: 'Alpha Bulletin',
    addressPrefix: 42,
    nodes: [{ url: 'wss://alpha-bulletin.example/rpc', name: 'RPC' }],
    assets: [],
    externalApi: { hop: ['wss://alpha-hop-0.example', 'wss://alpha-hop-1.example'] },
  },
];

const RELAY_HEX = '0xbe40bbaf734bbd701441808aeeddc250f7e749fc975a14aff5e3908af02953e5';
const PEOPLE_HEX = '0x107c56fe0f4792238395e7d582c571f59cf3f565a154a6fa26394d418bea1b3f';

describe('chainService.fromRemoteChains', () => {
  const raw = v.parse(remoteChainsSchema, ALPHA_RAW);
  const chains = chainService.fromRemoteChains(raw);

  it('keeps chainId as the chains_v2 label and derives genesisHash (0x-prefixed)', () => {
    expect(chains).toHaveLength(4);
    const relay = chains.find(c => c.name === 'Alpha Relay');
    expect(relay?.chainId).toBe('alpha-relay');
    expect(relay?.genesisHash).toBe(RELAY_HEX);
    expect(relay?.parentId).toBeUndefined();
  });

  it('resolves label parentId to the parent genesis hash', () => {
    const ah = chains.find(c => c.name === 'Alpha Asset Hub');
    expect(ah?.parentId).toBe(RELAY_HEX);
    expect(ah?.addressPrefix).toBe(0);
  });

  it('remaps assets: string icon → {monochrome,colored}, null type → native', () => {
    const ah = chains.find(c => c.name === 'Alpha Asset Hub');
    const usdc = ah?.assets.find(a => a.symbol === 'USDC');
    expect(usdc?.icon).toEqual({ monochrome: 'https://example.test/USDC.svg', colored: 'https://example.test/USDC.svg' });
    const usdt = ah?.assets.find(a => a.symbol === 'USDT');
    expect(usdt?.icon).toEqual({ monochrome: '', colored: '' });

    const people = chains.find(c => c.name === 'Alpha People');
    const pas = people?.assets[0];
    expect(pas?.type).toBe('native');
    expect(pas?.name).toBe('PAS'); // null name falls back to symbol
  });
});

describe('chainService role selectors', () => {
  const raw = v.parse(remoteChainsSchema, ALPHA_RAW);
  const chains = chainService.fromRemoteChains(raw);

  it('findRemoteChain resolves a role label to the transformed chain', () => {
    expect(chainService.findRemoteChain(chains, 'alpha-people')?.genesisHash).toBe(PEOPLE_HEX);
    expect(chainService.findRemoteChain(chains, 'nope')).toBeUndefined();
  });

  it('carries the bulletin HOP endpoints under externalApi', () => {
    expect(chains.find(c => c.chainId === 'alpha-bulletin')?.externalApi?.hop).toEqual([
      'wss://alpha-hop-0.example',
      'wss://alpha-hop-1.example',
    ]);
    expect(chains.find(c => c.chainId === 'alpha-relay')?.externalApi).toBeUndefined();
  });
});

describe('chainService.fromRemoteChains parent resolution', () => {
  it('warns and ungroups a parachain whose parentId has no resolvable genesis', () => {
    const node = [{ url: 'wss://x.example/rpc', name: 'RPC' }];
    // `ghost-relay` carries no genesis (empty + non-hex label), so it is itself
    // un-mappable and absent from the genesis map; `orphan-para` references it.
    const raw = v.parse(remoteChainsSchema, [
      { chainId: 'ghost-relay', genesisHash: '', parentId: null, name: 'Ghost Relay', addressPrefix: 0, nodes: node, assets: [] },
      {
        chainId: 'orphan-para',
        genesisHash: 'a'.repeat(64),
        parentId: 'ghost-relay',
        name: 'Orphan Para',
        addressPrefix: 0,
        nodes: node,
        assets: [],
      },
    ]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const chains = chainService.fromRemoteChains(raw);

    // ghost-relay is dropped (no genesis); orphan-para survives but loses its parent.
    expect(chains).toHaveLength(1);
    expect(chains[0]?.parentId).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('orphan-para'));

    warn.mockRestore();
  });
});
