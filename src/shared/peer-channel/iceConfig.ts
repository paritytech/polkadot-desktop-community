/**
 * RTCConfiguration builder. Google public STUN is always present; TURN relay enables traversal of
 * symmetric NATs. Credentials are derived from the shared secret per the TURN
 * REST scheme — see {@link deriveTurnCredentials}.
 */

import { hmac } from '@noble/hashes/hmac.js';
import { sha1 } from '@noble/hashes/legacy.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

const DEFAULT_STUN_URLS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun3.l.google.com:19302',
  'stun:stun4.l.google.com:19302',
];

/**
 * Fallback TURN credential lifetime when none is supplied via {@link IceConfigParams}.
 */
const DEFAULT_TURN_CREDENTIAL_TTL_SECONDS = 86_400;

export type IceConfigParams = {
  turnHost?: string;
  turnSecret?: string;
  /** Credential lifetime in seconds; falls back to {@link DEFAULT_TURN_CREDENTIAL_TTL_SECONDS}. */
  turnTtlSeconds?: number;
};

/**
 * Derive ephemeral TURN credentials per draft-uberti-behave-turn-rest-00 (the
 * coturn `static-auth-secret` / `use-auth-secret` scheme):
 *
 *   username = <unix-expiry-seconds>
 *   credential = base64( HMAC_SHA1( secret, username ) )
 *
 * The TURN server is configured with the same `secret`; on each allocation it
 * recomputes the HMAC over the presented username and accepts the request until
 * `now > expiry`. No per-credential state is stored on either side — the
 * timestamp IS the expiry, which is why no revocation channel is needed.
 *
 * Two details are load-bearing and coturn rejects anything else:
 *   - the digest is **SHA-1**, not SHA-256;
 *   - the credential is **base64 of the raw 20-byte digest**, not hex.
 *
 * Sync (noble HMAC) on purpose: `createPeerConnection` builds the config on the
 * deliberately-synchronous `spawn` path in the device-sync orchestrator, so we
 * avoid Web Crypto's async-only `subtle.sign`.
 */
function deriveTurnCredentials(
  secret: string,
  ttlSeconds = DEFAULT_TURN_CREDENTIAL_TTL_SECONDS,
): { username: string; credential: string } {
  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = String(expiry);
  const digest = hmac(sha1, utf8ToBytes(secret), utf8ToBytes(username));
  const credential = btoa(String.fromCharCode(...digest));

  return { username, credential };
}

export function buildIceConfig(params: IceConfigParams): RTCConfiguration {
  const iceServers: RTCIceServer[] = [{ urls: DEFAULT_STUN_URLS }];
  if (params.turnHost && params.turnSecret) {
    // Accept both `host:port` and pre-scheme'd `turn:host:port` / `turns:host:port`.
    // Without this guard a config-side `turn:` prefix becomes `turn:turn:host:port`,
    // which Chromium silently drops (no relay candidate gathered) — symptom is
    // identical to "no TURN configured".
    const hasScheme = /^turns?:/.test(params.turnHost);
    const url = hasScheme ? params.turnHost : `turn:${params.turnHost}`;
    const { username, credential } = deriveTurnCredentials(params.turnSecret, params.turnTtlSeconds);
    iceServers.push({
      urls: url,
      username,
      credential,
    });
  }
  return { iceServers };
}
