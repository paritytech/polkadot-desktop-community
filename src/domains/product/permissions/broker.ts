import { type Observable, BehaviorSubject } from 'rxjs';

import { promiseWithResolvers } from '@/shared/utils';

import { type PermissionModality } from './constants';
import { type PermissionStatus } from './types';

export type PendingRemotePermissionRequest = {
  productId: string;
  /** Modality the request originated from — the prompt's "Allow always" persists for this modality only. */
  modality: PermissionModality;
  /**
   * URL origin (scheme + host + port) — the pattern persisted if the user picks
   * "Allow always". Origin-wide granularity avoids prompt storms when a page
   * loads many assets from the same host.
   */
  origin: string;
  /** Original full URL that triggered the prompt, kept for display context. */
  url: string;
  /** Resolves the request; all coalesced callers receive the same status. */
  resolve(status: PermissionStatus): void;
};

type Resolver = (status: PermissionStatus) => void;

const pendingList$ = new BehaviorSubject<PendingRemotePermissionRequest[]>([]);
const resolversByKey = new Map<string, Resolver[]>();

export const pendingRemotePermissionRequests$: Observable<PendingRemotePermissionRequest[]> = pendingList$.asObservable();

const ALLOWED_PROMPT_SCHEMES: ReadonlySet<string> = new Set(['http:', 'https:', 'ws:', 'wss:']);

function toOrigin(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!ALLOWED_PROMPT_SCHEMES.has(parsed.protocol)) return null;
  return parsed.origin;
}

function dedupeKey(productId: string, origin: string, modality: PermissionModality): string {
  return `${productId}\0${origin}\0${modality}`;
}

/**
 * Concurrent callers for the same (productId, origin, modality) share a single pending
 * dialog — avoids prompt storms when a page loads many assets from one host.
 */
export function requestExternalUrlAccess({
  productId,
  url,
  modality,
}: {
  productId: string;
  url: string;
  modality: PermissionModality;
}): Promise<PermissionStatus> {
  const origin = toOrigin(url);
  if (!origin) return Promise.resolve('denied');

  const key = dedupeKey(productId, origin, modality);
  const { promise, resolve } = promiseWithResolvers<PermissionStatus>();

  const existing = resolversByKey.get(key);
  if (existing) {
    existing.push(resolve);
    return promise;
  }

  const resolvers: Resolver[] = [resolve];
  resolversByKey.set(key, resolvers);

  const pending: PendingRemotePermissionRequest = {
    productId,
    modality,
    origin,
    url,
    resolve: status => {
      if (resolversByKey.get(key) !== resolvers) return;
      resolversByKey.delete(key);
      pendingList$.next(pendingList$.value.filter(req => req !== pending));
      for (const r of resolvers) r(status);
    },
  };

  pendingList$.next([...pendingList$.value, pending]);
  return promise;
}

/** Test-only helper: resolve all in-flight promises as denied and clear state. */
export function _resetRemotePermissionBroker(): void {
  for (const resolvers of resolversByKey.values()) {
    for (const r of resolvers) r('denied');
  }
  resolversByKey.clear();
  pendingList$.next([]);
}
