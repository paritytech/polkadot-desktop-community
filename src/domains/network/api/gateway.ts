// Every light-client connection waits on the shared spec fetch, so a host that
// never answers would hold them all.
const LIGHT_SPEC_TIMEOUT_MS = 15_000;

async function fetchLightSpec(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { signal: AbortSignal.timeout(LIGHT_SPEC_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`[network] light spec ${url} answered ${response.status}`);
  }

  // Not validated here: the provider checks the bytes against the descriptor's
  // `sha256` in `addLightSpec`, and the digest covers the bytes as served.
  return new Uint8Array(await response.arrayBuffer());
}

export const lightClientGateway = { fetchLightSpec };
