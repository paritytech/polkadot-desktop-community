import { appId, author, electronProtocol, folders, title, updateServerUrl } from './config/index.js';

const CURRENT_YEAR = new Date().getFullYear();

/**
 * @type {import('electron-builder').Configuration}
 *
 * @see https://www.electron.build/configuration
 */
export default {
  appId: appId,
  productName: title,
  copyright: `Copyright © ${CURRENT_YEAR} — ${author.name}`,

  directories: {
    app: folders.devBuild,
    output: folders.prodBuild,
  },

  protocols: {
    name: title,
    schemes: [electronProtocol],
  },

  mac: {
    category: 'public.app-category.finance',
    hardenedRuntime: true,
    icon: `${folders.resources}/icons/icon.png`,
    entitlements: `${folders.resources}/entitlements/entitlements.mac.plist`,
    entitlementsInherit: `${folders.resources}/entitlements/entitlements.mac.plist`,
    target: [
      {
        target: 'dmg',
        arch: ['arm64', 'x64'],
      },
      {
        target: 'zip',
        arch: ['arm64', 'x64'],
      },
    ],
    notarize: true,
  },

  linux: {
    icon: `${folders.resources}/icons/icon.png`,
    category: 'Finance',
    target: ['AppImage'],
    mimeTypes: [`x-scheme-handler/${electronProtocol}`],
    desktop: {
      entry: {
        StartupWMClass: title,
      },
    },
  },

  win: {
    icon: `${folders.resources}/icons/icon.ico`,
    target: ['nsis'],
  },

  publish: updateServerUrl ? { provider: 'generic', url: updateServerUrl } : null,

  generateUpdatesFilesForAllChannels: false,
  detectUpdateChannel: false,

  compression: 'normal',
  artifactName: '${productName}-${version}-${arch}.${ext}',
};
