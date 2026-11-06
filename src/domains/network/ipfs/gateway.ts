const DEFAULT_TIMEOUT_MS = 30_000;

export type IpfsFetchOptions = {
  // Request the resource as a CAR archive instead of whatever the gateway serves natively.
  asCar?: boolean;
  timeoutMs?: number;
};

// The single IPFS gateway fetch — uncached, returns `null` on any failure.
// Pure wire I/O: the caller resolves the active `gatewayUrl` and passes it in.
// `ipfsRawResource` is the cached entry point for immutable blobs (icons,
// archives); callers that must NOT cache — e.g. polling for a preimage that
// hasn't propagated to the gateway yet — go through `ipfsUseCase.fetchRaw`,
// since even the resource's short hold on a miss would swallow their own retries.
async function fetchRaw(
  gatewayUrl: string,
  cid: string,
  { asCar = false, timeoutMs = DEFAULT_TIMEOUT_MS }: IpfsFetchOptions = {},
): Promise<Uint8Array | null> {
  const baseUrl = `${gatewayUrl}/${cid}`;
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
