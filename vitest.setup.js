import '@testing-library/jest-dom/vitest';

import { vi } from 'vitest';

// Config is sourced entirely from Firebase Remote Config (no bundled fallback),
// so unit tests — which have no live RC — must supply a deterministic snapshot,
// otherwise the Environment assembly throws on every config read. These are
// synthetic values for the `alpha` channel (the default in the test catalog);
// the chain ids here match the `alpha` roles in `vitest.config.ts`. Specs that
// test the remote-config gateway / chain transform import those modules by
// relative path and are NOT affected by this alias mock.
vi.mock('@/domains/remote-config', () => {
  const REMOTE_CONFIG_KEYS = {
    chains: 'chains_v2',
    dotNsConfig: 'dot_ns_config',
    ipfsGatewayUrl: 'ipfs_gateway_url',
    identityBackendUrl: 'identity_backend_url',
    w3sGateMode: 'w3s_gate_mode',
  };

  const node = url => [{ url, name: 'RPC' }];
  const chains = [
    {
      chainId: 'alpha-relay',
      genesisHash: '77afd6190f1554ad45fd0d31aee62aacc33c6db0ea801129acb813f913e0764f',
      parentId: null,
      name: 'Alpha Relay',
      addressPrefix: 0,
      nodes: node('wss://alpha-relay.example/rpc'),
      assets: [],
    },
    {
      chainId: 'alpha-asset-hub',
      genesisHash: 'bf0488dbe9daa1de1c08c5f743e26fdc2a4ecd74cf87dd1b4b1eeb99ae4ef19f',
      parentId: 'alpha-relay',
      name: 'Alpha Asset Hub',
      addressPrefix: 0,
      nodes: node('wss://alpha-asset-hub.example/rpc'),
      assets: [],
    },
    {
      chainId: 'alpha-people',
      genesisHash: 'c5af1826b31493f08b7e2a823842f98575b806a784126f28da9608c68665afa5',
      parentId: 'alpha-relay',
      name: 'Alpha People',
      addressPrefix: 42,
      nodes: node('wss://alpha-people.example/rpc'),
      assets: [],
    },
    {
      chainId: 'alpha-bulletin',
      genesisHash: '8cfe6717dc4becfda2e13c488a1e2061ff2dfee96e7d031157f72d36716c0a22',
      parentId: 'alpha-relay',
      name: 'Alpha Bulletin',
      addressPrefix: 42,
      nodes: node('wss://alpha-bulletin.example/rpc'),
      assets: [],
      externalApi: { hop: ['wss://alpha-bulletin.example/rpc'] },
    },
  ];

  const snapshot = {
    chains_v2: chains,
    dot_ns_config: {
      resolverContractAddress: '8A26480b0B5Df3d4D9b95adc24a5Ecb33A5b8F64',
      registryContractAddress: 'a1b2b939E82b2ecE55Bd8a0E283818BfC1CA6CDc',
    },
    ipfs_gateway_url: 'https://alpha-ipfs.example/ipfs/',
    identity_backend_url: 'https://alpha-identity.example/',
    w3s_gate_mode: 'VERIFICATION_ENABLED',
  };

  const tryGetJson = key => snapshot[key] ?? null;
  const tryGetString = key => snapshot[key] ?? null;

  return {
    REMOTE_CONFIG_KEYS,
    remoteUrlSchema: {},
    remoteConfigReady: Promise.resolve(),
    bootstrapRemoteConfig: () => {},
    remoteConfigGateway: {
      tryGetJson,
      tryGetString,
    },
  };
});
