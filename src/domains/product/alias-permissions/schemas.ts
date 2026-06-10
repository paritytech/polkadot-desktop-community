import * as v from 'valibot';

export const aliasPermissionSchema = v.object({
  key: v.string(),
  requesterProductId: v.string(),
  requestedContextId: v.string(),
  status: v.picklist(['granted', 'denied']),
});
