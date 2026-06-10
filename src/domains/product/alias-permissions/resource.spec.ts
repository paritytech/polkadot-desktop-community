import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./repository', () => ({
  aliasPermissionsDatabase: {
    table: { filter: vi.fn(), put: vi.fn(), delete: vi.fn() },
    stream$: vi.fn(),
  },
}));

import { aliasPermissionsDatabase } from './repository';
import { deleteAliasPermissionsByRequester } from './resource';

const deleteFn = vi.fn();

function makeRow(requesterProductId: string) {
  return {
    key: `${requesterProductId}::ctx`,
    requesterProductId,
    requestedContextId: 'ctx',
    status: 'granted' as const,
  };
}

describe('deleteAliasPermissionsByRequester', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
    vi.mocked(aliasPermissionsDatabase.table.filter).mockReturnValue({ delete: deleteFn } as any);
  });

  it('deletes every alias row stored under any raw variant of the requester id', async () => {
    await deleteAliasPermissionsByRequester('app.dot');

    expect(deleteFn).toHaveBeenCalledTimes(1);
    const predicate = vi.mocked(aliasPermissionsDatabase.table.filter).mock.calls[0]![0]!;
    expect(predicate(makeRow('app.dot'))).toBe(true);
    expect(predicate(makeRow('App.dot'))).toBe(true);
  });

  it('leaves alias rows of other requesters alone', async () => {
    await deleteAliasPermissionsByRequester('app.dot');

    const predicate = vi.mocked(aliasPermissionsDatabase.table.filter).mock.calls[0]![0]!;
    expect(predicate(makeRow('other.dot'))).toBe(false);
  });
});
