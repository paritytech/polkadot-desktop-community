import { environmentUseCase } from '@/domains/application';

const DEFAULT_TIMEOUT_MS = 30_000;

// Negative-cache backoff for callers that pass `backoff: true`. After a failure
// the same CID is skipped (returns null without a network round-trip) until the
// window elapses, so a missing CID is not re-requested on every read or mount.
// Off by default so pollers waiting for not-yet-propagated content keep retrying;
// only the cached resource opts in.
const BACKOFF_BASE_MS = 60_000;
const BACKOFF_MAX_MS = 30 * 60_000;
const failureBackoff = new Map<string, { failures: number; nextAttempt: number }>();

type FetchOptions = {
  // Request the resource as a CAR archive instead of whatever the gateway serves natively.
  asCar?: boolean;
  timeoutMs?: number;
  // Skip the network and return null while a recent failure for this CID is still
  // within its backoff window. Off by default; the cached resource opts in.
  backoff?: boolean;
};

// The single IPFS gateway fetch — uncached, returns `null` on any failure.
// `ipfsRawResource` layers caching on top of this for immutable blobs (icons,
// archives); callers that must NOT cache — e.g. polling for a preimage that
// hasn't propagated to the gateway yet — call this directly, since a cached
// miss would pin `null` forever.
async function fetchRaw(
  cid: string,
  { asCar = false, timeoutMs = DEFAULT_TIMEOUT_MS, backoff = false }: FetchOptions = {},
): Promise<Uint8Array | null> {
  const key = asCar ? `car:${cid}` : cid;
  if (backoff) {
    const entry = failureBackoff.get(key);
    if (entry && Date.now() < entry.nextAttempt) return null;
  }

  const baseUrl = `${(await environmentUseCase.getActive()).ipfsGatewayUrl}/${cid}`;
  const url = asCar ? `${baseUrl}?format=car` : baseUrl;
  const headers = asCar ? { Accept: 'application/vnd.ipld.car' } : undefined;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers });
    if (!response.ok) {
      if (backoff) recordFailure(key);
      return null;
    }

    failureBackoff.delete(key);
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    if (backoff) recordFailure(key);
    return null;
  }
}

function recordFailure(key: string): void {
  const failures = (failureBackoff.get(key)?.failures ?? 0) + 1;
  const wait = Math.min(BACKOFF_BASE_MS * 2 ** (failures - 1), BACKOFF_MAX_MS);
  failureBackoff.set(key, { failures, nextAttempt: Date.now() + wait });
}

export const ipfsGateway = { fetchRaw };
