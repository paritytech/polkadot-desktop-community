import { environmentUseCase } from '@/domains/application';

const DEFAULT_TIMEOUT_MS = 30_000;

type FetchOptions = {
  // Request the resource as a CAR archive instead of whatever the gateway serves natively.
  asCar?: boolean;
  timeoutMs?: number;
};

// The single IPFS gateway fetch — uncached, returns `null` on any failure.
// `ipfsRawResource` layers caching on top of this for immutable blobs (icons,
// archives); callers that must NOT cache — e.g. polling for a preimage that
// hasn't propagated to the gateway yet — call this directly, since a cached
// miss would pin `null` forever.
async function fetchRaw(
  cid: string,
  { asCar = false, timeoutMs = DEFAULT_TIMEOUT_MS }: FetchOptions = {},
): Promise<Uint8Array | null> {
  const baseUrl = `${(await environmentUseCase.getActive()).ipfsGatewayUrl}/${cid}`;
  const url = asCar ? `${baseUrl}?format=car` : baseUrl;
  const headers = asCar ? { Accept: 'application/vnd.ipld.car' } : undefined;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers });
    if (!response.ok) return null;

    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

export const ipfsGateway = { fetchRaw };
