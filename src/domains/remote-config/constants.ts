// Remote Config parameter keys (the contract with the Firebase console). `chains`
// and `dotNsConfig` are JSON; `ipfsGatewayUrl`/`identityBackendUrl` are raw strings.
export const REMOTE_CONFIG_KEYS = {
  chains: 'chains_v2',
  dotNsConfig: 'dot_ns_config',
  ipfsGatewayUrl: 'ipfs_gateway_url',
  identityBackendUrl: 'identity_backend_url',
} as const;

// Custom signal selecting the RC channel (via `setCustomSignals`). The value is
// the active channel id from `VITE_ENVIRONMENTS`; each id maps to a console
// condition. The only client-controllable input to RC condition evaluation.
export const REMOTE_CONFIG_SIGNAL_KEY = 'environment';

// Client-side fetch throttle (1h in production; app boundary may override to 0 in
// dev). RC also applies its own server-side throttle.
export const REMOTE_CONFIG_MIN_FETCH_INTERVAL_MS = 60 * 60 * 1000;

// Per-fetch network timeout; on timeout the SDK keeps the last-activated values.
export const REMOTE_CONFIG_FETCH_TIMEOUT_MS = 10_000;
