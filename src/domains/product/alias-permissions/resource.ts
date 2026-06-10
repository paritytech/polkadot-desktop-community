import { type Observable, from, map } from 'rxjs';
import * as v from 'valibot';

import { createStreamResource } from '@/shared/resource';
import { dotNsService } from '../dotns/service';

import { aliasPermissionsDatabase } from './repository';
import { aliasPermissionSchema } from './schemas';
import { aliasPermissionService } from './service';
import { type AliasPermission } from './types';

export const allAliasPermissionsResource = createStreamResource<object>({
  key: () => 'all',
})
  .subscribe<AliasPermission[]>(() => {
    return aliasPermissionsDatabase
      .stream$(table => table.toArray())
      .pipe(map(rows => rows.map(row => v.parse(aliasPermissionSchema, row))));
  })
  .cache<AliasPermission[]>({
    initial: [],
    map(_, permissions) {
      return permissions;
    },
  })
  .build();

export function setAliasPermission({
  requesterProductId,
  requestedContextId,
  status,
}: {
  requesterProductId: string;
  requestedContextId: string;
  status: AliasPermission['status'];
}): Observable<void> {
  const key = aliasPermissionService.getPermissionKey(requesterProductId, requestedContextId);

  return from(
    aliasPermissionsDatabase.table.put({
      key,
      requesterProductId,
      requestedContextId,
      status,
    }),
  ).pipe(map(() => undefined));
}

// Forget-flow cleanup: drop every alias decision the product made as
// requester. Rows store the raw webview identifier, so match through
// `isSameBaseName` rather than key equality.
export async function deleteAliasPermissionsByRequester(requesterProductId: string): Promise<void> {
  await aliasPermissionsDatabase.table
    .filter(row => dotNsService.isSameBaseName(row.requesterProductId, requesterProductId))
    .delete();
}

export function removeAliasPermission({
  requesterProductId,
  requestedContextId,
}: {
  requesterProductId: string;
  requestedContextId: string;
}): Observable<void> {
  const key = aliasPermissionService.getPermissionKey(requesterProductId, requestedContextId);

  return from(aliasPermissionsDatabase.table.delete(key)).pipe(map(() => undefined));
}
