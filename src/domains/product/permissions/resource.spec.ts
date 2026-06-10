import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./repository', () => ({
  productPermissionsDatabase: {
    table: { filter: vi.fn(), put: vi.fn() },
    stream$: vi.fn(),
  },
}));

import { productPermissionsDatabase } from './repository';
import { deleteProductPermissions } from './resource';

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
