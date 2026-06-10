import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

import { folders } from './config/index.js';

export default defineConfig({
  cacheDir: resolve(folders.root, 'node_modules/.cache/vitest-main'),
  test: {
    root: folders.root,
    dir: resolve(folders.root, 'main'),
    globals: true,
    environment: 'node',
    include: ['**/*.spec.ts'],
    pool: 'forks',
    reporters: ['dot', 'junit'],
    outputFile: {
      junit: resolve(folders.tmp, './junit-main.xml'),
    },
  },
  resolve: {
    alias: {
      '~config': resolve(folders.root, 'config/index.js'),
      // main/sandbox/lib.ts shares the modality union with the domain at runtime.
      '@': resolve(folders.root, 'src'),
    },
  },
});
