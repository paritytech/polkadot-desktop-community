import { getOperatingSystem, isElectron } from '@/shared/env';
import { createFeature } from '@/shared/feature';
import { type Environment } from '@/domains/application';
import { truapiRuntimeUseCase } from '@/aggregates/truapi-runtime';

import { createHostCallbacks } from './createHostCallbacks';
import { deferredHostPrompts } from './state/prompts';

/**
 * Hosts the TrUAPI core: assembles the host callbacks, boots the runtime, and owns
 * the review and permission prompts the core raises.
 *
 * Injects nothing today — `TruapiPromptsBinding` is mounted directly by the app
 * route, like the other headless bindings. The identifier exists so the feature is
 * registered and discoverable alongside the rest.
 */
export const productRuntimeFeature = createFeature({
  name: 'product/runtime',
});

/**
 * Boots the TrUAPI core. Called once from the app bootstrap, once the environment is
 * assembled: the stack the core runs comes from it.
 *
 * Not from a component: the route loaders wait for the core's first auth report
 * before they let the app render, so a core started by something those loaders keep
 * from mounting never reports, and the boot deadlocks on its loading screen. The
 * prompts are the one React-bound part of the host surface; the core asks through
 * `deferredHostPrompts`, which waits for the UI to register the real ones.
 */
export function bootstrapProductRuntime(environment: Environment): void {
  // The icon and the OS ride inside the pairing handshake so the mobile client can
  // show this host on its pairing screen and in its device list. Resolve them before
  // `start` because `start` is idempotent — a later config carrying them would be
  // ignored. It stays best-effort: missing metadata must not hold up the runtime.
  void resolveHostMetadata()
    .then(({ icon, platform }) =>
      truapiRuntimeUseCase.start(
        createHostCallbacks({ prompts: deferredHostPrompts, onAuthState: truapiRuntimeUseCase.publishAuthState }),
        {
          host: {
            name: 'Polkadot Desktop',
            version: process.env['VERSION'],
            icon,
            platform: isElectron() ? 'Desktop' : 'Web',
          },
          platform,
          stack: environment.stack,
          // The scheme the Polkadot App registers (`AppConfig+DeepLink.swift`), which is
          // what makes the emitted `polkadotapp://pair?handshake=0x…` openable. dotli
          // configures the same value (`packages/ui/src/runtime-config.ts`).
          pairing: { deeplinkScheme: 'polkadotapp' },
        },
      ),
    )
    .then(() => console.debug('[truapi] runtime started'))
    .catch((error: unknown) => console.error('[truapi] runtime failed to start', error));
}

/**
 * The host icon and OS sent in the pairing handshake, from the same source the main
 * process reports over `getHostMetadata`. Best-effort: on a build without the `App`
 * bridge (web) the OS type comes from the user agent and there is no icon or OS
 * version; an IPC failure yields the same, and the core mints the handshake without
 * them rather than failing pairing.
 */
async function resolveHostMetadata(): Promise<{
  icon: string | undefined;
  platform: { type?: string; version?: string };
}> {
  try {
    const metadata = await window.App?.getHostMetadata();

    if (metadata) {
      return {
        icon: metadata.hostIcon,
        platform: { type: metadata.platformType, version: metadata.platformVersion },
      };
    }
  } catch {
    // Fall through to what the renderer can tell on its own.
  }

  return { icon: undefined, platform: { type: getOperatingSystem() } };
}
