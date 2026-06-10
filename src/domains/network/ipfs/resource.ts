import { createQueryResource } from '@/shared/resource';

import { ipfsGateway } from './gateway';

// Cached raw IPFS gateway fetch, keyed by CID + form. `asCar` requests the
// resource as a CAR archive; the canonical/default form is whatever the gateway
// serves natively. Both forms are cached independently so consumers (icons,
// archives, generic blobs) share fetches by CID. The fetch itself lives in
// `ipfsGateway`; this resource only adds caching.
export const ipfsRawResource = createQueryResource<{ cid: string; asCar?: boolean }>({
  key: ({ cid, asCar }) => (asCar ? `car:${cid}` : cid),
})
  .request<Uint8Array | null>(({ cid, asCar }) => ipfsGateway.fetchRaw(cid, { asCar }))
  .timeout(60_000)
  .cache<Record<string, Uint8Array>>({
    staleAfter: Number.POSITIVE_INFINITY,
    initial: {},
    map(cache, value, params) {
      if (!value) return cache;
      const key = params.asCar ? `car:${params.cid}` : params.cid;
      return { ...cache, [key]: value };
    },
  })
  .build();
