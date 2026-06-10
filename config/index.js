import { resolve } from 'node:path';

import packageJson from '../package.json' with { type: 'json' };

const { author: AUTHOR, description: DESCRIPTION, name: NAME, version: VERSION } = packageJson;

export const name = NAME;
export const author = AUTHOR;
export const version = VERSION;
export const description = DESCRIPTION;
export const electronProtocol = 'polkadot';
export const title = process.env.NODE_ENV === 'staging' ? 'Polkadot Desktop Stage' : 'Polkadot Desktop';
export const appId =
  process.env.NODE_ENV === 'staging'
    ? 'com.polkadot.desktop.stage'
    : 'com.polkadot.desktop';

export const main = {
  window: {
    width: 800,
    defaultWidth: 1372,
    height: 800,
    defaultHeight: 800,
  },
};

const rendererUrl = new URL('https://localhost:4000');

export const renderer = {
  server: {
    origin: rendererUrl.origin,
    protocol: rendererUrl.protocol,
    host: rendererUrl.hostname,
    port: parseInt(rendererUrl.port),
  },
};

// Base URL for auto-updater feed. The runtime appends a channel suffix
// (`stable/` or `latest/` for experimental) before passing it to electron-updater.
export const updateServerUrl = process.env.AUTO_UPDATE_URL;

export const folders = {
  entrypoint: {
    main: resolve('./main/index.ts'),
    preload: resolve('./main/preload.ts'),
    renderer: resolve('./src/index.html'),
  },

  root: resolve('./'),
  mainRoot: resolve('./main'),
  rendererRoot: resolve('./src'),
  resources: resolve('./main/resources'),
  docs: resolve('./docs'),

  devBuild: resolve('./release/build'),
  prodBuild: resolve('./release/dist'),
  storybookBuild: resolve('./release/storybook'),
  docsBuild: resolve('./release/docs'),

  coverage: resolve('./.coverage'),
  cache: resolve('./node_modules/.cache'),
  tmp: resolve('./node_modules/.tmp'),
};
