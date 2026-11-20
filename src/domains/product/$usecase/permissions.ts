import { type PermissionAuthorizationRequest, type PermissionAuthorizationStatus } from '@parity/truapi-host';
import { type Observable, combineLatest, debounceTime, from, map, of, switchMap } from 'rxjs';

import { createSideEffect } from '@/shared/di';
import { withTimeout } from '@/shared/utils';
import { coreStorageRepository } from '../core-storage/repository';
import { parsePermissionAuthorizationRequest } from '../permissions/schemas';
import { permissionsService } from '../permissions/service';
import {
  type AggregatedPermission,
  type AppPermissionEntry,
  type GrantedAccountAccess,
  type GrantedPattern,
  type PermissionStatus,
  type PermissionsAdapter,
  type ProductPermissionEntry,
} from '../permissions/types';

/**
 * Fired when a granted Camera/Microphone request is blocked by the OS, so the feature layer
 * can route the user to system privacy settings. Named for the event, not the handler.
 */
export const onDeviceOsPermissionBlockedSideEffect = createSideEffect<{ permission: 'Camera' | 'Microphone' }>({
  name: 'onDeviceOsPermissionBlocked',
});

// The core owns every permission decision. This is the domain's only way to reach it.
//
// Two shapes of read live here and they answer different questions. The CATALOGUE read
// builds its request list from the fixed permission ids and batches one call, so a
// product with no decisions still renders every settings row at its default. The
// ENUMERATION reads go to the core-storage slot index, because remote domains and
// account-access targets have unbounded key spaces that no fixed list can cover.
//
// Both re-emit when the slot index emits. That works because the core persists every
// decision THROUGH the host's own storage callbacks, so our local write is the change
// signal — no polling, no second subscription.

/**
 * Bounded so a read can never hang.
 *
 * `whenRuntimeReady()` behind the adapter never settles if the core never starts, and
 * this call sits on the Electron camera and microphone gate. A hung prompt is worse
 * than a denied one.
 */
const READ_TIMEOUT_MS = 5_000;

let adapter: PermissionsAdapter | null = null;

/**
 * In-flight lookups only — NOT a cache.
 *
 * Worker startup resolves many module imports through the remote-access gate in a
 * burst, and the Dexie subscription that used to absorb that is gone with the local
 * store. Collapsing concurrent identical lookups keeps that off the wire. The entry is
 * dropped when the BOUNDED promise settles, so a hung adapter cannot wedge a key, and
 * the resolved value is never retained: a stale `granted` is the one wrong answer that
 * matters.
 */
const inFlight = new Map<string, Promise<PermissionStatus>>();

function setPermissionsAdapter(next: PermissionsAdapter | null): void {
  adapter = next;
}

/** Test-only. Mirrors `_resetTransientDevicePermissionGrants`. */
function _resetPermissionLookups(): void {
  inFlight.clear();
}

function lookupKey(productId: string, request: PermissionAuthorizationRequest): string {
  return `${productId}\0${JSON.stringify(request)}`;
}

// Every read fails closed. `withTimeout` is a bare `Promise.race`, so a rejection
// passes straight through it and needs its own catch.
function readStatuses(productId: string, requests: PermissionAuthorizationRequest[]): Promise<PermissionAuthorizationStatus[]> {
  const fallback = requests.map((): PermissionAuthorizationStatus => 'NotDetermined');
  if (!adapter || requests.length === 0) return Promise.resolve(fallback);

  return withTimeout(adapter.getStatuses(productId, requests), READ_TIMEOUT_MS, fallback).catch(error => {
    console.warn('[permissions] core status read failed, failing closed', { productId, error });

    return fallback;
  });
}

function getPermissionStatus({
  productId,
  request,
}: {
  productId: string;
  request: PermissionAuthorizationRequest;
}): Promise<PermissionStatus> {
  const key = lookupKey(productId, request);
  const pending = inFlight.get(key);
  if (pending) return pending;

  const current = adapter;
  const read = current
    ? withTimeout(current.getStatus(productId, request), READ_TIMEOUT_MS, 'NotDetermined').catch(
        (error: unknown): PermissionAuthorizationStatus => {
          console.warn('[permissions] core status read failed, failing closed', { productId, error });

          return 'NotDetermined';
        },
      )
    : Promise.resolve<PermissionAuthorizationStatus>('NotDetermined');

  const bounded = read.then(permissionsService.fromAuthorizationStatus).finally(() => inFlight.delete(key));
  inFlight.set(key, bounded);

  return bounded;
}

async function setPermissionStatus({
  productId,
  request,
  status,
}: {
  productId: string;
  request: PermissionAuthorizationRequest;
  status: PermissionStatus;
}): Promise<void> {
  if (!adapter) return;

  await adapter.setStatus(productId, request, permissionsService.toAuthorizationStatus(status));
}

/** Every permission slot the core holds for a product, as typed requests. */
function slotRequests$(productId: string): Observable<PermissionAuthorizationRequest[]> {
  return coreStorageRepository.permissionSlots$(productId).pipe(
    map(rows =>
      rows.flatMap(row => {
        const request = parsePermissionAuthorizationRequest(row);

        return request ? [request] : [];
      }),
    ),
  );
}

/**
 * A product's settings catalogue: one entry per fixed permission id, one batched read.
 *
 * Deliberately not driven by the slot index — a product that has answered nothing has
 * no slots, and its settings page must still render every row.
 */
function watchProductPermissions({ productId }: { productId: string }): Observable<ProductPermissionEntry[]> {
  const requests = permissionsService.catalogueRequests();

  return coreStorageRepository.permissionSlots$(productId).pipe(
    debounceTime(0),
    switchMap(() => from(readStatuses(productId, requests))),
    map(statuses =>
      requests.flatMap((request, index): ProductPermissionEntry[] => {
        const permissionId = permissionsService.fromAuthorizationRequest(request);
        const status = statuses[index];
        if (!permissionId || !status) return [];

        return [{ permissionId, status: permissionsService.fromAuthorizationStatus(status) }];
      }),
    ),
  );
}

function watchProductsWithPermissions(): Observable<string[]> {
  return coreStorageRepository.productIdsWithPermissionSlots$();
}

/**
 * Granted and denied remote domains for a product.
 *
 * A slot may hold a bundle: the core writes one key for a multi-domain answer, so a
 * row can carry several domains that all share its status. Flattened one row per
 * domain, and de-duplicated with the per-domain slot winning, because that is the
 * order the core resolves them in.
 */
function watchGrantedPatterns({ productId }: { productId: string }): Observable<GrantedPattern[]> {
  return slotRequests$(productId).pipe(
    debounceTime(0),
    switchMap(requests => {
      const remote = requests.filter(request => request.tag === 'Remote' && request.value.permission.tag === 'Remote');
      if (remote.length === 0) return of<GrantedPattern[]>([]);

      return from(readStatuses(productId, remote)).pipe(
        map(statuses => {
          const single = new Map<string, PermissionStatus>();
          const bundled = new Map<string, PermissionStatus>();

          for (const [index, request] of remote.entries()) {
            const raw = statuses[index];
            if (raw === undefined) continue;
            if (request.tag !== 'Remote' || request.value.permission.tag !== 'Remote') continue;

            const domains = request.value.permission.value.domains;
            const status = permissionsService.fromAuthorizationStatus(raw);
            // A single-domain slot is the per-domain answer the core consults first, so
            // it must win over a bundle that also mentions the domain.
            const target = domains.length === 1 ? single : bundled;
            for (const domain of domains) target.set(domain, status);
          }

          for (const [domain, status] of single) bundled.set(domain, status);

          return [...bundled].map(([pattern, status]): GrantedPattern => ({ pattern, status }));
        }),
      );
    }),
  );
}

function watchGrantedAccountAccess({ productId }: { productId: string }): Observable<GrantedAccountAccess[]> {
  return slotRequests$(productId).pipe(
    debounceTime(0),
    switchMap(requests => {
      const access = requests.filter(request => request.tag === 'AccountAccess');
      if (access.length === 0) return of<GrantedAccountAccess[]>([]);

      return from(readStatuses(productId, access)).pipe(
        map(statuses =>
          access.flatMap((request, index): GrantedAccountAccess[] => {
            const raw = statuses[index];
            if (raw === undefined || request.tag !== 'AccountAccess') return [];

            return [
              {
                targetProductId: request.value.targetProductId,
                status: permissionsService.fromAuthorizationStatus(raw),
              },
            ];
          }),
        ),
      );
    }),
  );
}

/**
 * Every permission rolled up across every product that holds one.
 *
 * An accepted N+1: one batched read per product, re-run whenever the slot index emits.
 * Only the permission-settings pages subscribe to it, and the index input is debounced
 * so a single write does not fan out into a burst.
 */
function watchAggregatedPermissions(): Observable<AggregatedPermission[]> {
  return watchProductsWithPermissions().pipe(
    debounceTime(0),
    switchMap(productIds => {
      if (productIds.length === 0) return of<AggregatedPermission[]>([]);

      return combineLatest(
        productIds.map(productId => watchProductPermissions({ productId }).pipe(map(entries => ({ productId, entries })))),
      ).pipe(
        map(perProduct => {
          const byPermission = new Map<string, AppPermissionEntry[]>();

          for (const { productId, entries } of perProduct) {
            for (const entry of entries) {
              const apps = byPermission.get(entry.permissionId) ?? [];
              apps.push({ productId, status: entry.status });
              byPermission.set(entry.permissionId, apps);
            }
          }

          return [...byPermission].map(([id, apps]): AggregatedPermission => ({
            id,
            grantedCount: apps.filter(app => app.status === 'granted').length,
            apps,
          }));
        }),
      );
    }),
  );
}

export const permissionsUseCase = {
  setPermissionsAdapter,
  watchProductPermissions,
  watchProductsWithPermissions,
  watchGrantedPatterns,
  watchGrantedAccountAccess,
  watchAggregatedPermissions,
  getPermissionStatus,
  setPermissionStatus,
  _resetPermissionLookups,
};
