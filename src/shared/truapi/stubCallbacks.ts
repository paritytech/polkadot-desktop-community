import { type RequiredHostCallbacks } from '@parity/truapi-host';

// A complete `RequiredHostCallbacks` where every method rejects and every stream
// is empty. Used to boot the core in isolation — for verifying that the wasm and
// its worker resolve at all, and as the base a test overrides one capability of.
//
// Deliberately exhaustive: the core requires every capability trait, so a
// partial stub fails at init rather than at the callback that is missing.

function notImplemented(name: string): () => Promise<never> {
  return () => Promise.reject(new Error(`truapi host callback not implemented: ${name}`));
}

// An async generator with no yields is the empty stream.
async function* emptyStream(): AsyncGenerator<never> {}

export function createStubHostCallbacks(): RequiredHostCallbacks {
  return {
    navigation: { navigateTo: notImplemented('navigateTo') },
    notifications: {
      pushNotification: notImplemented('pushNotification'),
      cancelNotification: notImplemented('cancelNotification'),
    },
    permissions: {
      devicePermission: notImplemented('devicePermission'),
      remotePermission: notImplemented('remotePermission'),
    },
    features: {
      featureSupported: notImplemented('featureSupported'),
      supportedChains: notImplemented('supportedChains'),
    },
    extrinsicVersion: { transactionExtensionVersions: notImplemented('transactionExtensionVersions') },
    productStorage: {
      read: notImplemented('productStorage.read'),
      write: notImplemented('productStorage.write'),
      clear: notImplemented('productStorage.clear'),
      subscribeStorage: emptyStream,
    },
    coreStorage: {
      readCoreStorage: notImplemented('readCoreStorage'),
      writeCoreStorage: notImplemented('writeCoreStorage'),
      clearCoreStorage: notImplemented('clearCoreStorage'),
    },
    chain: { connect: notImplemented('chain.connect') },
    auth: { authStateChanged: () => undefined },
    userConfirmation: {
      confirmUserAction: notImplemented('confirmUserAction'),
      confirmPermission: notImplemented('confirmPermission'),
    },
    productOperations: {
      beginOperation: notImplemented('beginOperation'),
      endOperation: notImplemented('endOperation'),
    },
    theme: { subscribeTheme: emptyStream },
    preimage: { lookupPreimage: emptyStream },
    locale: { subscribeLocale: emptyStream },
  };
}
