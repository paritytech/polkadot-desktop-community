import { resolve } from 'node:path';

import { type ViteUserConfig, type ViteUserConfigFnPromise, mergeConfig } from 'vitest/config';
import { type TestSpecification, BaseSequencer } from 'vitest/node';

import { folders } from './config/index.js';
import rendererConfig from './vite.config.renderer.js';

// Synthetic catalog for tests — no real environment names. The `alpha` roles
// match the chain ids in the remote-config mock in `vitest.setup.js`.
const TEST_ENVIRONMENTS = JSON.stringify({
  default: 'alpha',
  shared: {
    hostChatNetwork: 'example-net',
    iosBundleId: 'com.example.app',
    digitalDollarAsset: { assetId: 1, symbol: 'tUSD', precision: 6, palletName: 'Assets' },
  },
  channels: {
    alpha: {
      name: 'Alpha Testnet',
      stack: 'paseo-next-v2',
      roles: { people: 'alpha-people', bulletin: 'alpha-bulletin', assetHub: 'alpha-asset-hub' },
    },
    beta: {
      name: 'Beta Testnet',
      stack: 'previewnet',
      roles: { people: 'beta-people', bulletin: 'beta-bulletin', assetHub: 'beta-asset-hub' },
    },
  },
});

const testsPriority = [
  resolve(folders.rendererRoot, 'domains'),
  resolve(folders.rendererRoot, 'aggregates'),
  resolve(folders.rendererRoot, 'features'),
  resolve(folders.rendererRoot, 'shared'),
  // ... other
];

class Sequencer extends BaseSequencer {
  async sort(files: TestSpecification[]) {
    return files.sort((a, b) => {
      const ac = testsPriority.findIndex(dir => a.moduleId.startsWith(dir));
      const bc = testsPriority.findIndex(dir => b.moduleId.startsWith(dir));

      if (ac === -1) return 1;
      if (bc === -1) return -1;

      return ac - bc;
    });
  }
}

const config: ViteUserConfigFnPromise = async options => {
  const base = await rendererConfig(options);
  const config: ViteUserConfig = {
    cacheDir: resolve(folders.root, 'node_modules/.cache/vitest'),
    test: {
      root: folders.root,
      dir: folders.rendererRoot,
      globals: true,
      setupFiles: resolve(folders.root, './vitest.setup.js'),
      reporters: ['dot', 'junit'],
      outputFile: {
        junit: resolve(folders.tmp, './junit-renderer.xml'),
      },
      sequence: {
        sequencer: Sequencer,
      },
      // Loaded by Node outside Vite, a Radix menu and a dialog opened from one of its items loop on focus in
      // happy-dom; Vite loads them as the app bundle does.
      server: { deps: { inline: [/@radix-ui/, /@novasamatech\/tr-ui/] } },
      coverage: {
        provider: 'v8',
        exclude: ['**/node_modules/**'],
        reportsDirectory: folders.coverage,
        thresholds: {
          branches: 25,
          functions: 10,
          lines: 10,
          statements: 10,
        },
        reporter: 'json-summary',
      },
      pool: 'threads',
      maxConcurrency: 8,
      deps: { optimizer: { client: { enabled: true } } },
      // The environment domain reads `VITE_ENVIRONMENTS` at module init; provide
      // the synthetic test catalog defined above.
      env: { VITE_ENVIRONMENTS: TEST_ENVIRONMENTS },
    },
  };

  return mergeConfig(base, config);
};

export default config;
