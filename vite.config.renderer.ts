import { resolve } from 'node:path';

import { type UserConfigFn } from 'vite';

import { folders, renderer, title, version } from './config/index.js';

const config: UserConfigFn = async ({ mode, command }) => {
  const { defineConfig } = await import('vite');

  const { default: svgr } = await import('vite-plugin-svgr');
  const { default: favicons } = await import('@peterek/vite-plugin-favicons');
  const { default: react } = await import('@vitejs/plugin-react');
  const { default: mkcert } = await import('vite-plugin-mkcert');
  const { default: wasm } = await import('vite-plugin-wasm');

  const { tanstackRouter } = await import('@tanstack/router-plugin/vite');

  const { default: tailwindcss } = await import('@tailwindcss/vite');
  const { sentryVitePlugin } = await import('@sentry/vite-plugin');
  const svgrOxcOptions = {
    jsx: 'react-jsx',
  };

  const isDev = mode === 'development';
  const isStage = mode === 'staging';

  return defineConfig({
    mode: isStage ? 'production' : mode,
    cacheDir: resolve(folders.cache, 'vite-renderer'),
    base: '',
    root: folders.rendererRoot,
    // `.env` files live in the project root; without this `envDir` defaults to
    // `root` (src/) and no `VITE_*` var loads in the renderer.
    envDir: folders.root,
    define: {
      'process.env.PRODUCT_NAME': JSON.stringify(title),
      'process.env.VERSION': JSON.stringify(version),
      'process.env.BUILD_TIME': JSON.stringify(new Date().toISOString()),
      'process.env.BUILD_SOURCE': JSON.stringify(process.env['BUILD_SOURCE']),
      'process.env.LOGGER': JSON.stringify(process.env['LOGGER']),
      'process.env.SENTRY_DSN': JSON.stringify(process.env['SENTRY_DSN'] ?? ''),
      // AUTOTEST, BOT_URL, BOT_TOKEN are runtime values injected via preload bridge (window.App)
      // Not compile-time — allows reusing the same build for normal and e2e runs
    },
    optimizeDeps: {
      exclude: [
        '@jitl/quickjs-wasmfile-release-asyncify',
        'emscripten-module',
        'quickjs-emscripten',
        '@novasamatech/host-chat',
        '@novasamatech/handoff-service',
      ],
    },
    worker: {
      format: 'es',
    },
    resolve: {
      tsconfigPaths: true,
      // Force a single instance for SCALE codecs across desktop + linked SDK packages.
      // scale-ts uses `instanceof InternalUint8Array` to track decoder byte position
      // through nested codecs; with the host-papp SDK linked from triangle-js-sdks,
      // multiple scale-ts copies get bundled and that check fails across realms,
      // resetting position to 0 and breaking the V2 handshake codec.
      dedupe: ['react', 'react-dom', 'scale-ts', '@novasamatech/scale', '@novasamatech/statement-store'],
    },
    build: {
      sourcemap: isDev ? undefined : 'hidden',
      chunkSizeWarningLimit: Infinity,
      minify: !isDev,
      outDir: folders.devBuild,
      emptyOutDir: false,
      target: 'es2022',
      rolldownOptions: {
        onLog(level, log, handler) {
          if (log.cause) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            const cause = log.cause as Record<string, string>;

            if (cause['message'] === `Can't resolve original location of error.`) {
              return;
            }
          }

          handler(level, log);
        },
      },
    },
    // assetsInclude: ['**/*.wasm'],
    server: {
      port: renderer.server.port,
    },
    plugins: [
      tanstackRouter({
        target: 'react',
        routesDirectory: resolve(folders.rendererRoot, 'routes'),
        generatedRouteTree: resolve(folders.rendererRoot, 'routeTree.gen.ts'),
        quoteStyle: 'single',
        autoCodeSplitting: true,
        tmpDir: resolve(folders.tmp, 'tanstack-router'),
      }),

      command === 'serve' && mode !== 'test' && mkcert(),

      wasm(),

      tailwindcss(),

      react({
        babel: {
          compact: false,
          plugins: [
            'react-compiler',
            command === 'serve'
              ? [
                  'effector/babel-plugin',
                  {
                    hmr: false,
                    addNames: true,
                    addLoc: true,
                  },
                ]
              : null,
          ].filter(x => x !== null),
        },
        exclude: /useTranslation\.ts$/,
      }),
      svgr({
        include: '**/*.svg?jsx',
        // @ts-expect-error upstream typing mismatch in vite-plugin-svgr
        oxcOptions: svgrOxcOptions,
        svgrOptions: {
          plugins: ['@svgr/plugin-svgo', '@svgr/plugin-jsx'],
          memo: true,
          ref: true,
          jsxRuntime: 'automatic',
          svgo: true,
          svgoConfig: {
            plugins: [
              {
                name: 'preset-default',
                params: { overrides: { removeViewBox: false, cleanupIds: false } },
              },
            ],
          },
        },
      }),
      favicons(
        mode === 'development' ? resolve(folders.rendererRoot, 'favicon.dev.png') : resolve(folders.rendererRoot, 'favicon.png'),
        {
          appName: 'Polkadot Desktop',
          appShortName: 'Dot Desktop',
          appDescription: '',
          icons: {
            android: true,
            appleIcon: true,
            appleStartup: true,
            favicons: true,
            windows: true,
            yandex: true,
          },
        },
      ),
      // VitePWA({
      //   devOptions: { enabled: true, type: 'module' },
      //   scope: './',
      //   injectRegister: null,
      //   strategies: 'injectManifest',
      //   srcDir: '.',
      //   filename: 'sw.ts',
      //   injectManifest: {
      //     injectionPoint: undefined,
      //     plugins: commonPlugins,
      //   },
      // }),
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
