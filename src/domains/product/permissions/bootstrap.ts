import { firstValueFrom } from 'rxjs';

import { requestExternalUrlAccess } from './broker';
import { getTransientDevicePermissionGranted, productPermissionsResource } from './resource';
import { permissionsService } from './service';

type BootstrapPermissionsConfig = {
  /**
   * Behaviour when an external-URL request matches no stored permission:
   * `true` → prompt the user; `false` → deny silently. Automated/e2e runs pass
   * `false` so probes observe a fast 403 and UI tests aren't blocked by an
   * unexpected modal. The flag is injected by the app bootstrap — the domain
   * holds no knowledge of test environments.
   */
  promptForUnmatchedRemoteAccess: boolean;
};

const readPermissionsOnce = (productId: string) => firstValueFrom(productPermissionsResource.read$({ productId }));

// Registers the renderer's product-permission IPC request handlers on the host.
// Called explicitly from the app bootstrap (never at import time), so the domain
// owns no hidden load-order side effects. No-op outside a renderer with a host
// bridge (web build, node-env tests).
export function bootstrapPermissions({ promptForUnmatchedRemoteAccess }: BootstrapPermissionsConfig): void {
  if (typeof window === 'undefined' || !window.App) return;

  window.App.onDevicePermissionRequest(async ({ productId, permission, executable }) => {
    const modality = permissionsService.modalityForKind(executable);
    // A live "allow once" grant for this session opens the native gate without a
    // persisted 'granted'. Checked before the persisted lookup (and before any IO).
    if (getTransientDevicePermissionGranted({ productId, permission, modality })) {
      return 'granted';
    }
    const permissions = await readPermissionsOnce(productId);
    return permissionsService.getDevicePermissionStatus(permissions, permission, modality) ?? 'ask';
  });

  window.App.onRemotePermissionRequest(async ({ productId, executable, request }) => {
    if (request.tag !== 'Remote') return 'denied';

    const permissions = await readPermissionsOnce(productId);
    const modality = permissionsService.modalityForKind(executable);
    // Roll-up through the service chokepoint so overlapping patterns resolve
    // identically here and on the SDK path (granted only if every match grants).
    const stored = permissionsService.getRemotePermissionRequestStatus(
      permissions,
      { tag: 'Remote', value: [request.url] },
      modality,
    );

    // A stored (or rolled-up) 'ask' is "undecided", not a decision — fall through
    // to the prompt path; the sandbox treats any non-'granted' reply as a deny.
    if (stored && stored !== 'ask') return stored;

    if (!promptForUnmatchedRemoteAccess) return 'denied';

    return requestExternalUrlAccess({ productId, url: request.url, modality });
  });
}
