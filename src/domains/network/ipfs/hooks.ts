import { useRead } from '@/shared/hooks';
import { nonNullable } from '@/shared/utils';

import { ipfsRawResource } from './resource';

export const useIpfsRawData = (cid: Nullable<string>) => {
  return useRead(ipfsRawResource, {
    params: nonNullable(cid) ? { cid } : null,
    defaultValue: null,
    map: (cache, { cid }) => cache[cid] ?? null,
  });
};
