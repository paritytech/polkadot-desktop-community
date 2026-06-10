import { NEVER, firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../product/resource', () => ({
  productsResource: { read$: vi.fn() },
}));

vi.mock('../permissions/resource', () => ({
  allProductPermissionsResource: { read$: vi.fn() },
}));

vi.mock('../alias-permissions/resource', () => ({
  allAliasPermissionsResource: { read$: vi.fn() },
}));

import { allAliasPermissionsResource } from '../alias-permissions/resource';
import { allProductPermissionsResource } from '../permissions/resource';
import { productsResource } from '../product/resource';

import { type InteractedProduct, interactionUseCase } from './interaction';

function committedNames(result: InteractedProduct[]) {
  return result.filter(entry => entry.kind === 'committed').map(entry => entry.product.baseName);
}

function permissionOnlyIds(result: InteractedProduct[]) {
  return result.filter(entry => entry.kind === 'permissionOnly').map(entry => entry.productId);
}

function makeRecord(baseName: string) {
  return {
    baseName,
    displayName: baseName,
    description: '',
    icon: { cid: 'abc', format: 'png' as const },
    executables: {},
    pinned: false,
    createdAt: 1000,
    updatedAt: 1000,
  };
}

function makePermissionsRow(productId: string) {
  return {
    productId,
    devicePermissions: [{ payload: { name: 'Camera' as const }, modality: 'app' as const, status: 'granted' as const }],
    remotePermissions: [],
  };
}

// A row that exists but holds no standing decision — produced by reset-to-'ask'
// flows that put back `{ productId, devicePermissions: [], remotePermissions: [] }`.
function makeEmptyPermissionsRow(productId: string) {
  return { productId, devicePermissions: [], remotePermissions: [] };
}

function makeAliasRow(requesterProductId: string) {
  return {
    key: `${requesterProductId}::ctx`,
    requesterProductId,
    requestedContextId: 'ctx',
    status: 'granted' as const,
  };
}

describe('interactionUseCase.watchInteractedProducts', () => {
  beforeEach(() => {
    vi.mocked(productsResource.read$).mockReturnValue(of([]));
    vi.mocked(allProductPermissionsResource.read$).mockReturnValue(of([]));
    vi.mocked(allAliasPermissionsResource.read$).mockReturnValue(of([]));
  });

  it('returns committed products with no permission-only ids when stores are empty', async () => {
    vi.mocked(productsResource.read$).mockReturnValue(of([makeRecord('committed.dot')]));

    const result = await firstValueFrom(interactionUseCase.watchInteractedProducts());

    expect(committedNames(result)).toEqual(['committed.dot']);
    expect(permissionOnlyIds(result)).toEqual([]);
  });

  it('orders committed products before permission-only entries', async () => {
    vi.mocked(productsResource.read$).mockReturnValue(of([makeRecord('committed.dot')]));
    vi.mocked(allProductPermissionsResource.read$).mockReturnValue(of([makePermissionsRow('browsed.dot')]));

    const result = await firstValueFrom(interactionUseCase.watchInteractedProducts());

    expect(result.map(entry => entry.kind)).toEqual(['committed', 'permissionOnly']);
  });

  it('lists a product with a permissions row but no committed row as permission-only', async () => {
    vi.mocked(allProductPermissionsResource.read$).mockReturnValue(of([makePermissionsRow('browsed.dot')]));

    const result = await firstValueFrom(interactionUseCase.watchInteractedProducts());

    expect(committedNames(result)).toEqual([]);
    expect(permissionOnlyIds(result)).toEqual(['browsed.dot']);
  });

  it('lists an alias requester with no committed row as permission-only', async () => {
    vi.mocked(allAliasPermissionsResource.read$).mockReturnValue(of([makeAliasRow('aliased.dot')]));

    const result = await firstValueFrom(interactionUseCase.watchInteractedProducts());

    expect(permissionOnlyIds(result)).toEqual(['aliased.dot']);
  });

  it('does not duplicate a committed product that also has permission rows', async () => {
    vi.mocked(productsResource.read$).mockReturnValue(of([makeRecord('committed.dot')]));
    vi.mocked(allProductPermissionsResource.read$).mockReturnValue(of([makePermissionsRow('committed.dot')]));
    vi.mocked(allAliasPermissionsResource.read$).mockReturnValue(of([makeAliasRow('committed.dot')]));

    const result = await firstValueFrom(interactionUseCase.watchInteractedProducts());

    expect(committedNames(result)).toEqual(['committed.dot']);
    expect(permissionOnlyIds(result)).toEqual([]);
  });

  it('returns permission-only ids sorted', async () => {
    vi.mocked(allProductPermissionsResource.read$).mockReturnValue(
      of([makePermissionsRow('zebra.dot'), makePermissionsRow('alpha.dot')]),
    );

    const result = await firstValueFrom(interactionUseCase.watchInteractedProducts());

    expect(permissionOnlyIds(result)).toEqual(['alpha.dot', 'zebra.dot']);
  });

  it('dedups a product present in both the permissions and alias stores', async () => {
    vi.mocked(allProductPermissionsResource.read$).mockReturnValue(of([makePermissionsRow('browsed.dot')]));
    vi.mocked(allAliasPermissionsResource.read$).mockReturnValue(of([makeAliasRow('browsed.dot')]));

    const result = await firstValueFrom(interactionUseCase.watchInteractedProducts());

    expect(permissionOnlyIds(result)).toEqual(['browsed.dot']);
  });

  it('dedups a permission row stored under a raw unnormalized id against its committed product', async () => {
    // Permission rows store the raw webview identifier; committed baseName is
    // always baseNameOf()-normalized (lowercase, '.dot'-suffixed).
    vi.mocked(productsResource.read$).mockReturnValue(of([makeRecord('localhost:5173.dot')]));
    vi.mocked(allProductPermissionsResource.read$).mockReturnValue(of([makePermissionsRow('localhost:5173')]));

    const result = await firstValueFrom(interactionUseCase.watchInteractedProducts());

    expect(permissionOnlyIds(result)).toEqual([]);
  });

  it('dedups raw-id variants of the same uncommitted product into one entry', async () => {
    vi.mocked(allProductPermissionsResource.read$).mockReturnValue(of([makePermissionsRow('Browsed.dot')]));
    vi.mocked(allAliasPermissionsResource.read$).mockReturnValue(of([makeAliasRow('browsed.dot')]));

    const result = await firstValueFrom(interactionUseCase.watchInteractedProducts());

    expect(permissionOnlyIds(result)).toEqual(['Browsed.dot']);
  });

  it('ignores permission rows that hold no stored decisions', async () => {
    vi.mocked(allProductPermissionsResource.read$).mockReturnValue(of([makeEmptyPermissionsRow('reset.dot')]));

    const result = await firstValueFrom(interactionUseCase.watchInteractedProducts());

    expect(permissionOnlyIds(result)).toEqual([]);
  });

  it('keeps emitting committed products when a permission stream errors', async () => {
    vi.mocked(productsResource.read$).mockReturnValue(of([makeRecord('committed.dot')]));
    vi.mocked(allProductPermissionsResource.read$).mockReturnValue(throwError(() => new Error('corrupt row')));

    const result = await firstValueFrom(interactionUseCase.watchInteractedProducts());

    expect(committedNames(result)).toEqual(['committed.dot']);
    expect(permissionOnlyIds(result)).toEqual([]);
  });

  it('emits committed products before the permission streams produce a first value', async () => {
    vi.mocked(productsResource.read$).mockReturnValue(of([makeRecord('committed.dot')]));
    vi.mocked(allProductPermissionsResource.read$).mockReturnValue(NEVER);
    vi.mocked(allAliasPermissionsResource.read$).mockReturnValue(NEVER);

    const result = await firstValueFrom(interactionUseCase.watchInteractedProducts());

    expect(committedNames(result)).toEqual(['committed.dot']);
    expect(permissionOnlyIds(result)).toEqual([]);
  });
});
