import { resolve } from 'path';

import { type UserConfigFn } from 'vite';

import { autoUpdateUrl, folders, title, updateRepo, version } from './config/index.js';

const config: UserConfigFn = async ({ mode }) => {
  const { defineConfig } = await import('vite');
  // @ts-expect-error Broken types
  const { default: target } = await import('vite-plugin-target');
  const { sentryVitePlugin } = await import('@sentry/vite-plugin');

  const isDev = mode === 'development';

  const rendererSource = process.env['RENDERER_SOURCE'] || (isDev ? 'localhost' : 'filesystem');

  return defineConfig({
    mode,
    cacheDir: resolve(folders.cache, 'vite-main'),
    define: {
      'process.env.PRODUCT_NAME': JSON.stringify(title),
      'process.env.VERSION': JSON.stringify(version),
      'process.env.ENABLE_AUTO_UPDATE': JSON.stringify(process.env['ENABLE_AUTO_UPDATE'] ?? ''),
      'process.env.AUTO_UPDATE_URL': JSON.stringify(autoUpdateUrl),
      'process.env.UPDATE_REPO_OWNER': JSON.stringify(updateRepo.owner),
      'process.env.UPDATE_REPO_NAME': JSON.stringify(updateRepo.name),
      'process.env.RENDERER_SOURCE': JSON.stringify(rendererSource),
      'process.env.LOGGER': JSON.stringify(process.env['LOGGER']),
      'process.env.SENTRY_DSN': JSON.stringify(process.env['SENTRY_DSN'] ?? ''),
    },
    resolve: {
      tsconfigPaths: true,
      // output format is cjs — resolve deps to their cjs builds so `import.meta` never reaches the bundle
      conditions: ['node', 'require'],
    },
    build: {
      sourcemap: isDev ? undefined : 'hidden',
      outDir: folders.devBuild,
      emptyOutDir: false,
      lib: {
        entry: folders.entrypoint.main,
        fileName: () => 'main.cjs',
        formats: ['cjs'],
      },
      rolldownOptions: {
        output: {
          globals: {
            process: 'process',
          },
        },
      },
    },
    plugins: [
      target({ 'electron-main': {} }),
      sentryVitePlugin({
        org: process.env['SENTRY_ORG'],
        project: process.env['SENTRY_PROJECT'],
        authToken: process.env['SENTRY_AUTH_TOKEN'],
        release: { name: `polkadot-desktop@${version}` },
        sourcemaps: { filesToDeleteAfterUpload: ['**/*.js.map'] },
        disable: !process.env['SENTRY_AUTH_TOKEN'],
      }),
    ],
  });
};

export default config;
