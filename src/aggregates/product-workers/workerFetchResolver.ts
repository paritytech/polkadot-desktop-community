import { useCallback } from 'react';

import { isElectron } from '@/shared/env';
import { useLooseRef } from '@/shared/hooks';
import {
  type FetchResolver,
  type ProductPermissions,
  permissionsService,
  requestExternalUrlAccess,
  useProductPermissions,
} from '@/domains/product';

type FetchRequest = Parameters<FetchResolver>[0];
type FetchResponse = Awaited<ReturnType<FetchResolver>>;

// Mirrors the webview's `blockedResponse` — a denied URL gets a 403 rather than a thrown error.
const BLOCKED_RESPONSE: FetchResponse = { status: 403, statusText: 'Forbidden', headers: [], body: new Uint8Array() };

function rejectOnAbort(signal: AbortSignal): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    const abort = () => reject(new DOMException('The operation was aborted', 'AbortError'));
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
  });
}

// Same decision the webview's remote-permission handler makes: honor a stored Remote pattern,
// otherwise prompt through the broker (which coalesces concurrent requests by origin and
// persists the user's choice via the app-wide RemotePermissionPromptHost).
async function isRemoteAllowed(productId: string, url: string, permissions: ProductPermissions | null): Promise<boolean> {
  const stored = permissionsService.getRemotePermissionRequestStatus(permissions, { tag: 'Remote', value: [url] }, 'app');
  const status = stored ?? (await requestExternalUrlAccess({ productId, url, modality: 'app' }));
  return status === 'granted';
}

async function performFetch(req: FetchRequest): Promise<FetchResponse> {
  // In Electron, run through the main process (net.fetch) to bypass renderer CORS, like the
  // webview. On web there is no main process, so fall back to the renderer's own fetch.
  if (isElectron() && window.App?.proxyFetch) {
    return Promise.race([
      window.App.proxyFetch({ url: req.url, method: req.method, headers: req.headers, body: req.body }),
      rejectOnAbort(req.signal),
    ]);
  }

  const response = await fetch(req.url, {
    method: req.method,
    headers: req.headers,
    // Re-wrap into an ArrayBuffer-backed view so it satisfies BodyInit.
    body: req.body ? new Uint8Array(req.body) : null,
    signal: req.signal,
  });

  return {
    status: response.status,
    statusText: response.statusText,
    headers: [...response.headers],
    body: new Uint8Array(await response.arrayBuffer()),
    url: response.url,
    redirected: response.redirected,
  };
}

/**
 * Builds the worker's `fetch` resolver, gated against the product's remote permissions the same
 * way the webview is. Stable across renders; reads the latest permissions on each call so grants
 * made after the worker starts take effect immediately.
 */
export function useWorkerFetchResolver(productId: Nullable<string>): FetchResolver {
  const { data: permissions } = useProductPermissions(productId);
  const permissionsRef = useLooseRef(permissions);
  const productIdRef = useLooseRef(productId);

  return useCallback<FetchResolver>(async req => {
    const productId = productIdRef();
    if (!productId) return BLOCKED_RESPONSE;

    const allowed = await isRemoteAllowed(productId, req.url, permissionsRef());

    return allowed ? performFetch(req) : BLOCKED_RESPONSE;
  }, []);
}
