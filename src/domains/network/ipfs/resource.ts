import { createQueryResource } from '@/shared/resource';

import { ipfsGateway } from './gateway';

// A miss is held briefly so a dead CID costs one gateway request per 30 s per
// client instead of one per read — and only briefly, because the gateway answers
// 5xx both for content that is gone and for content it can't reach right now
// (paritytech/polkadot-bulletin-chain#641), so a miss may heal on the next try.
const MISS_RETRY_AFTER_MS = 30_000;

// Cached raw IPFS gateway fetch, keyed by CID + form. `asCar` requests the
// resource as a CAR archive; the canonical/default form is whatever the gateway
// serves natively. Both forms are cached independently so consumers (icons,
// archives, generic blobs) share fetches by CID.
//
// `gatewayUrl` is a parameter, not something this resource resolves: the active
// environment comes from `environmentUseCase`, and a resource never calls a use
// case. Callers that already sit above it (hooks, use cases) pass it down.
// It is deliberately NOT part of the cache key — IPFS content is addressed by
// CID, so the same CID is the same bytes whichever gateway served it, and
// keying by CID alone keeps the cache warm across an environment switch.
//
// Fetched bytes are kept for the session: a CID names fixed content, so a
// refetch could only return the same bytes.
export const ipfsRawResource = createQueryResource<{ cid: string; gatewayUrl: string; asCar?: boolean }>({
  key: ({ cid, asCar }) => (asCar ? `car:${cid}` : cid),
})
  .request<Uint8Array | null>(({ cid, gatewayUrl, asCar }) => ipfsGateway.fetchRaw(gatewayUrl, cid, { asCar }))
  .mock(() => null)
  .timeout(60_000)
  .cache<Record<string, Uint8Array>>({
    staleAfter: bytes => (bytes ? Number.POSITIVE_INFINITY : MISS_RETRY_AFTER_MS),
    initial: {},
    map(cache, value, params) {
      if (!value) return cache;
      const key = params.asCar ? `car:${params.cid}` : params.cid;

      return { ...cache, [key]: value };
    },
  })
  .build();
