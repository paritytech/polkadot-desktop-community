import { type ExecutableKind } from '@parity/truapi-host';

import { requestExternalUrlAccess } from '../permissions/broker';
import { permissionsService } from '../permissions/service';
import { type PermissionStatus } from '../permissions/types';

import { permissionsUseCase } from './permissions';

// Whether an external-URL request that matches no stored permission prompts the user.
// Injected once at bootstrap (see permissions/bootstrap.ts) so the domain stays
// unaware of test environments. Defaults to closed until bootstrap runs.
let promptWhenUnmatched = false;

function setRemoteAccessPromptPolicy(enabled: boolean): void {
  promptWhenUnmatched = enabled;
}

/**
 * Single enforcement chokepoint for "may this product reach this external URL?".
 * Honors a decided stored pattern; otherwise prompts (policy on) or denies (policy off).
 * Used by the permission IPC handler, the worker fetch resolver, and the navigateTo binding.
 */
async function resolveRemoteUrlAccess({
  productId,
  url,
  executionKind,
}: {
  productId: string;
  url: string;
  executionKind: ExecutableKind;
}): Promise<PermissionStatus> {
  // `toAuthorizationRequest` reduces the URL to the bare host the core keys on, the
  // same normalization the allow-always write path applies, so read and write agree.
  const request = permissionsService.toAuthorizationRequest('ExternalRequest', { pattern: url });
  const stored = request ? await permissionsUseCase.getPermissionStatus({ productId, request }) : 'ask';

  // A stored 'ask' is "undecided" — fall through to the prompt path.
  if (stored !== 'ask') return stored;
  if (!promptWhenUnmatched) return 'denied';

  return requestExternalUrlAccess({ productId, url, executionKind });
}

export const remoteAccessUseCase = { resolveRemoteUrlAccess, setRemoteAccessPromptPolicy };
