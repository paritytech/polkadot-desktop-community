import { describe, expect, it } from 'vitest';

import { aliasPermissionService } from './service';
import { type AliasPermission } from './types';

describe('aliasPermissionService.getPermissionKey', () => {
  it('builds a deterministic storage key', () => {
    expect(aliasPermissionService.getPermissionKey('requester.dot', 'target.dot')).toBe('requester.dot::target.dot');
  });
});

describe('aliasPermissionService.getStatus', () => {
  const permissions: AliasPermission[] = [
    {
      key: aliasPermissionService.getPermissionKey('requester-a.dot', 'target-a.dot'),
      requesterProductId: 'requester-a.dot',
      requestedContextId: 'target-a.dot',
      status: 'granted',
    },
    {
      key: aliasPermissionService.getPermissionKey('requester-b.dot', 'target-b.dot'),
      requesterProductId: 'requester-b.dot',
      requestedContextId: 'target-b.dot',
      status: 'denied',
    },
  ];

  it('returns granted when an exact permission entry exists', () => {
    expect(aliasPermissionService.getStatus(permissions, 'requester-a.dot', 'target-a.dot')).toBe('granted');
  });

  it('returns denied when an exact denied permission entry exists', () => {
    expect(aliasPermissionService.getStatus(permissions, 'requester-b.dot', 'target-b.dot')).toBe('denied');
  });

  it('returns ask when permission entry does not exist', () => {
    expect(aliasPermissionService.getStatus(permissions, 'unknown.dot', 'target-a.dot')).toBe('ask');
  });
});
