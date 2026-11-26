import '@testing-library/jest-dom/vitest';

import { toast } from 'sonner';
import { afterEach, vi } from 'vitest';

import { resetExecutionEnvironment, setExecutionEnvironment } from '@/shared/execution-environment';

// Node-env specs (no happy-dom) transitively reach persistLocalStorage, which
// reads `localStorage`. Without a DOM the global is absent and every persisted
// read logs a recoverable error (persist.ts). Give those specs an in-memory
// store; DOM specs already have happy-dom's and skip this.
const usesLocalStorageShim = typeof globalThis.localStorage === 'undefined';
if (usesLocalStorageShim) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: key => void store.delete(key),
    clear: () => store.clear(),
  };
}

// Every resource (and, once it subscribes, every RxState) returns to its initial
// value here, so a spec never inherits a cached value or an `instead` override
// from the test before it. vitest runs `afterEach` hooks in reverse registration
// order and this file registers before any spec is imported, so this runs after
// Testing Library has already unmounted — nothing here emits into a mounted tree.
afterEach(() => {
  resetExecutionEnvironment();
  // sonner's store is a module singleton that replays active toasts to a Toaster that
  // subscribes later, so a toast one test left open would show up in the next test's Toaster.
  toast.dismiss();
  // A case may switch to 'runtime' to reach a real request; put every file back
  // on the test environment so the next case's mocks are served again.
  setExecutionEnvironment('test');
  // Unconditionally, not only for the Node shim: a persisted state resets to its
  // initial value without writing, so storage must be cleared with it or the
  // next case reads a value the state no longer holds.
  globalThis.localStorage.clear();
});

// Under the test environment every resource that declared a `.mock(...)` serves
// it, so a spec gets a working double without wiring one. Resources with no
// mock are untouched and still run their real request.
setExecutionEnvironment('test');

// Config is sourced entirely from Firebase Remote Config (no bundled fallback),
// so unit tests — which have no live RC — must supply a deterministic snapshot,
// otherwise the Environment assembly throws on every config read. These are
// synthetic values for the `alpha` channel (the default in the test catalog);
// the chain ids here match the `alpha` roles in `vitest.config.ts`. Specs that
// test the remote-config gateway / chain transform import those modules by
// relative path and are NOT affected by this alias mock.
vi.mock('@/domains/remote-config', async () => {
  const v = await import('valibot');

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
    remoteUrlSchema: v.pipe(v.string(), v.url()),
    remoteConfigReady: Promise.resolve(),
    bootstrapRemoteConfig: () => {},
    remoteConfigGateway: {
      tryGetJson,
      tryGetString,
    },
  };
});
