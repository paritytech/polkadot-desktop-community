import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./repository', () => ({
  productPermissionsDatabase: {
    table: { filter: vi.fn(), put: vi.fn() },
    stream$: vi.fn(),
  },
}));

import { productPermissionsDatabase } from './repository';
import {
  _resetTransientDevicePermissionGrants,
  clearTransientDevicePermissionGrants,
  deleteProductPermissions,
  getTransientDevicePermissionGranted,
  grantTransientDevicePermission,
} from './resource';

const deleteFn = vi.fn();

function makeRow(productId: string) {
  return { productId, devicePermissions: [], remotePermissions: [] };
}

describe('deleteProductPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
    vi.mocked(productPermissionsDatabase.table.filter).mockReturnValue({ delete: deleteFn } as any);
  });

  it('deletes rows stored under any raw variant of the product id', async () => {
    await deleteProductPermissions('localhost:5173.dot');

    expect(deleteFn).toHaveBeenCalledTimes(1);
    const predicate = vi.mocked(productPermissionsDatabase.table.filter).mock.calls[0]![0]!;
    expect(predicate(makeRow('localhost:5173'))).toBe(true);
    expect(predicate(makeRow('Localhost:5173.dot'))).toBe(true);
  });

  it('leaves rows of other products alone', async () => {
    await deleteProductPermissions('app.dot');

    const predicate = vi.mocked(productPermissionsDatabase.table.filter).mock.calls[0]![0]!;
    expect(predicate(makeRow('other.dot'))).toBe(false);
  });
});

describe('transient device permission grants', () => {
  beforeEach(() => {
    _resetTransientDevicePermissionGrants();
  });

  it('is not granted by default', () => {
    expect(getTransientDevicePermissionGranted({ productId: 'p.dot', permission: 'Camera', modality: 'app' })).toBe(false);
  });

  it('grants for an exact (productId, permission, modality) key', () => {
    grantTransientDevicePermission({ productId: 'p.dot', permission: 'Camera', modality: 'app' });

    expect(getTransientDevicePermissionGranted({ productId: 'p.dot', permission: 'Camera', modality: 'app' })).toBe(true);
  });

  it('isolates by permission, modality, and productId', () => {
    grantTransientDevicePermission({ productId: 'p.dot', permission: 'Camera', modality: 'app' });

    expect(getTransientDevicePermissionGranted({ productId: 'p.dot', permission: 'Microphone', modality: 'app' })).toBe(false);
    expect(getTransientDevicePermissionGranted({ productId: 'p.dot', permission: 'Camera', modality: 'widget' })).toBe(false);
    expect(getTransientDevicePermissionGranted({ productId: 'other.dot', permission: 'Camera', modality: 'app' })).toBe(false);
  });

  it('clears all of a product+modality grants but leaves other products and modalities', () => {
    grantTransientDevicePermission({ productId: 'p.dot', permission: 'Camera', modality: 'app' });
    grantTransientDevicePermission({ productId: 'p.dot', permission: 'Microphone', modality: 'app' });
    grantTransientDevicePermission({ productId: 'p.dot', permission: 'Camera', modality: 'widget' });
    grantTransientDevicePermission({ productId: 'other.dot', permission: 'Camera', modality: 'app' });

    clearTransientDevicePermissionGrants({ productId: 'p.dot', modality: 'app' });

    expect(getTransientDevicePermissionGranted({ productId: 'p.dot', permission: 'Camera', modality: 'app' })).toBe(false);
    expect(getTransientDevicePermissionGranted({ productId: 'p.dot', permission: 'Microphone', modality: 'app' })).toBe(false);
    expect(getTransientDevicePermissionGranted({ productId: 'p.dot', permission: 'Camera', modality: 'widget' })).toBe(true);
    expect(getTransientDevicePermissionGranted({ productId: 'other.dot', permission: 'Camera', modality: 'app' })).toBe(true);
  });
});
