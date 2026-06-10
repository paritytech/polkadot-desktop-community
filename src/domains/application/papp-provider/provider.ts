import { type HostMetadata, type PappAdapter } from '@novasamatech/host-papp';

import { isElectron } from '@/shared/env';

import { createPappAdapterWithHostMetadata, getHostMetadataForWeb } from './service';

// Module-level singleton: all consumers share one PappAdapter instance.
// Without this, each call to `usePappProvider()` previously ran its own
// `createPappAdapterWithHostMetadata` in an effect, which spawns its own
// `ssoSessionRepository` + `createSsoSessionManager` + `createUserSession`
// for every userSession known to storage. With 10+ ProductContainerBinding
// integrations all calling the hook, the host ended up with 20+ ghost
// sessions, each with its own statement-store subscriptions, each appending
// to its own `outgoingRequest` batch on the bulletin chain.
//
// Lives here (not in `hooks.ts`) so non-React consumers — bootstrap, route
// loaders, the device/user-identity readers in `identity.ts` — can obtain the
// adapter without importing a React hook module.
let singleton: PappAdapter | null = null;
let promise: Promise<PappAdapter> | null = null;
const listeners = new Set<(provider: PappAdapter) => void>();

export const getPappProvider = (): PappAdapter | null => singleton;

export const subscribePappProvider = (listener: (provider: PappAdapter) => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const ensurePappProvider = async (): Promise<PappAdapter> => {
  if (singleton) return singleton;
  if (promise) return promise;

  promise = (async () => {
    const hostMetadata: HostMetadata =
      isElectron() && window.App?.getHostMetadata ? await window.App.getHostMetadata() : getHostMetadataForWeb();
    const provider = createPappAdapterWithHostMetadata(hostMetadata);
    singleton = provider;
    for (const listener of listeners) listener(provider);
    return provider;
  })();

  return promise;
};
