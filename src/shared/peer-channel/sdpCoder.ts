/**
 * SDP ↔ MinimalSetup translation (parity with Android's `SdpCoder.kt`).
 * Wire SDP fields (`SignalingMessage.Offer.sdp` / `.Answer.sdp`) are not raw
 * SDP — they carry SCALE(MinimalSetup). We extract the seven canonical fields
 * for transport and rebuild a fixed-template SDP on the other side. Anything
 * outside the template (extensions, extra m-sections, non-default codecs)
 * is lost on purpose. Initial candidates inside MinimalSetup are surfaced
 * separately for `addIceCandidate` — the template omits inline candidate lines.
 */

import { type CodecType } from 'scale-ts';

import { type MinimalCandidate, minimalToRtcCandidateInit, rtcCandidateToMinimal } from './iceCandidate';
import { MinimalSetupCodec } from './signaling';

type MinimalSetup = CodecType<typeof MinimalSetupCodec>;

export type EncodedSdpSetup = {
  setupSdp: string;
  candidates: RTCIceCandidateInit[];
};

/**
 * Decode a `MinimalSetup` blob (the payload of `SignalingMessage.Offer.sdp`
 * or `.Answer.sdp`) into:
 *   - `setupSdp` — a reconstructed SDP suitable for `setRemoteDescription`
 *   - `candidates` — initial ICE candidates the peer baked into the setup;
 *     pass each through `addIceCandidate` AFTER applying the description.
 */
export function decodeMinimalSetup(bytes: Uint8Array): EncodedSdpSetup {
  const setup = MinimalSetupCodec.dec(bytes);
  return {
    setupSdp: reconstructSdpBase(setup),
    candidates: setup.candidates.map(c => minimalToRtcCandidateInit(c)),
  };
}

/**
 * Encode a local WebRTC offer/answer + (optionally) the candidates we've
 * already gathered into a `MinimalSetup` blob ready to go on the wire as
 * `SignalingMessage.Offer.sdp` or `.Answer.sdp`.
 *
 * If we haven't gathered any candidates yet at send time (the usual case
 * for trickle ICE), pass an empty `gathered` — they'll trickle later via
 * `SignalingMessage.Candidates`.
 */
export function encodeMinimalSetup(localSdp: string, gathered: RTCIceCandidate[] = []): Uint8Array {
  const parsed = parseSdpBase(localSdp);
  const candidates: MinimalCandidate[] = [];
  for (const c of gathered) {
    const m = rtcCandidateToMinimal(c);
    if (m) candidates.push(m);
  }
  const setup: MinimalSetup = {
    sdpType: { tag: parsed.sdpType === 'offer' ? 'OFFER' : 'ANSWER', value: undefined },
    sessionId: parsed.sessionId,
    sessionVersion: parsed.sessionVersion,
    iceUFrag: parsed.iceUFrag,
    icePwd: parsed.icePwd,
    fingerprint: parsed.fingerprint,
    candidates,
  };
  return MinimalSetupCodec.enc(setup);
}

// ── Internal: parse SDP text → MinimalSetup fields ──────────────────────

type SdpDirection = 'offer' | 'answer';

type ParsedSdpBase = {
  sdpType: SdpDirection;
  sessionId: bigint;
  sessionVersion: bigint;
  iceUFrag: string;
  icePwd: string;
  fingerprint: Uint8Array;
};

function parseSdpBase(sdp: string): ParsedSdpBase {
  let iceUFrag = '';
  let icePwd = '';
  let fingerprintHex = '';
  let sdpType: SdpDirection = 'offer';
  let sessionId = 0n;
  let sessionVersion = 0n;

  for (const rawLine of sdp.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('a=ice-ufrag:')) {
      iceUFrag = line.slice('a=ice-ufrag:'.length);
    } else if (line.startsWith('a=ice-pwd:')) {
      icePwd = line.slice('a=ice-pwd:'.length);
    } else if (line.startsWith('a=fingerprint:')) {
      fingerprintHex = line.slice('a=fingerprint:'.length);
    } else if (line.startsWith('a=setup:')) {
      // `actpass` is what the offerer emits; `active`/`passive` are the
      // answerer's commitments. Map back to the binary offer/answer tag the
      // way Android does (any non-`actpass` is treated as answer).
      const setup = line.slice('a=setup:'.length);
      sdpType = setup === 'actpass' ? 'offer' : 'answer';
    } else if (line.startsWith('o=')) {
      // `o=- <sessionId> <sessionVersion> IN IP4 0.0.0.0`
      const parts = line
        .slice('o='.length)
        .split(' ')
        .filter(p => p.length > 0);
      if (parts.length >= 3) {
        try {
          sessionId = BigInt(parts[1]!);
        } catch {
          /* leave 0n */
        }
        try {
          sessionVersion = BigInt(parts[2]!);
        } catch {
          /* leave 0n */
        }
      }
    }
  }

  return {
    sdpType,
    sessionId,
    sessionVersion,
    iceUFrag,
    icePwd,
    fingerprint: parseFingerprint(fingerprintHex),
  };
}

/** Parse "sha-256 AA:BB:CC:..." → raw 32-byte hash. */
function parseFingerprint(value: string): Uint8Array {
  const trimmed = value.trim();
  // Strip optional "sha-256 " (or whatever hash family) prefix.
  const hexPart = trimmed.includes(' ') ? trimmed.slice(trimmed.indexOf(' ') + 1) : trimmed;
  const clean = hexPart.replace(/:/g, '').replace(/\s+/g, '');
  if (clean.length % 2 !== 0) return new Uint8Array();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Format raw 32-byte hash → "AA:BB:CC:…". */
function formatFingerprint(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (const b of bytes) parts.push(b.toString(16).padStart(2, '0').toUpperCase());
  return `sha-256 ${parts.join(':')}`;
}

// ── Internal: rebuild SDP text from MinimalSetup ────────────────────────

function reconstructSdpBase(setup: MinimalSetup): string {
  const setupAttr = setup.sdpType.tag === 'OFFER' ? 'actpass' : 'active';
  const fingerprint = formatFingerprint(setup.fingerprint);
  // The template MUST match Android's `reconstructSdpBase` line-for-line.
  // WebRTC's parser is permissive but order/keys matter. The trailing
  // newline is intentional — without it `setRemoteDescription` choked on
  // the last attribute on at least Chromium.
  return (
    `v=0\r\n` +
    `o=- ${setup.sessionId.toString()} ${setup.sessionVersion.toString()} IN IP4 0.0.0.0\r\n` +
    `s=-\r\n` +
    `t=0 0\r\n` +
    `m=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n` +
    `c=IN IP4 0.0.0.0\r\n` +
    `a=ice-ufrag:${setup.iceUFrag}\r\n` +
    `a=ice-pwd:${setup.icePwd}\r\n` +
    `a=fingerprint:${fingerprint}\r\n` +
    `a=setup:${setupAttr}\r\n` +
    `a=mid:0\r\n` +
    `a=sctp-port:5000\r\n`
  );
}
