/**
 * SCALE codecs for WebRTC signaling content (byte-for-byte parity with
 * Android `SignalingMessage`):
 *   Reconnected(0) / Offer{sdp:Bytes}(1) / Answer{sdp:Bytes}(2) /
 *   Candidates{candidates:Bytes}(3)
 * `Offer.sdp` / `Answer.sdp` are SCALE(MinimalSetup), not raw SDP.
 * `Candidates.candidates` is a Bytes blob wrapping Vec<MinimalCandidate>.
 * MinimalCandidate is the cross-platform projection of RTCIceCandidate
 * (foundation/priority/transport/address/port/type); mDNS/TURN extras drop.
 */

import { Bytes, Enum, Struct, Vector, _void, compact, i32, str, u16 } from 'scale-ts';

export const TransportTypeCodec = Enum({
  TCP: _void, // 0
  UDP: _void, // 1
});

// Ipv4(u8,u8,u8,u8) — 4 raw bytes, no length prefix (positional).
const Ipv4Codec = Bytes(4);

// Ipv6(u16×8) — 8 little-endian u16 values = 16 raw bytes, no length prefix.
// Byte-equivalent to Bytes(16); we use that for ergonomics on the JS side
// (consumers get a Uint8Array, not an object of named u16 fields).
const Ipv6Codec = Bytes(16);

export const IpAddressCodec = Enum({
  Ipv4: Ipv4Codec, // 0
  Ipv6: Ipv6Codec, // 1
});

export const CandidateTypeCodec = Enum({
  HOST: _void, // 0
  SRFLX: _void, // 1
  RELAY: _void, // 2
  PRFLX: _void, // 3
});

export const MinimalCandidateCodec = Struct({
  foundation: str,
  priority: i32,
  transportType: TransportTypeCodec,
  address: IpAddressCodec,
  port: u16,
  candidateType: CandidateTypeCodec,
});

export const MinimalCandidatesVecCodec = Vector(MinimalCandidateCodec);

// SdpType (1-byte enum tag) — distinguishes whether the MinimalSetup payload
// holds an offer or an answer. Matches Kotlin
// `@Serializable enum class SdpType { OFFER, ANSWER }` (ordinals).
export const SdpTypeCodec = Enum({
  OFFER: _void, // 0
  ANSWER: _void, // 1
});

// `MinimalSetup` is the actual payload of `SignalingMessage.Offer.sdp` and
// `.Answer.sdp`. It is NOT raw SDP text — the SDP is decomposed into the
// minimal fields needed to rebuild a working WebRTC session descriptor on
// the other side. See Android reference at
// `tools/media-connection/impl/.../signaling/SdpCoder.kt`.
//
//   sdpType         (1-byte enum tag: OFFER=0 / ANSWER=1)
//   sessionId       (SCALE compact bigint — extracted from SDP "o=" line)
//   sessionVersion  (SCALE compact bigint — same)
//   iceUFrag        (UTF-8 string, from a=ice-ufrag)
//   icePwd          (UTF-8 string, from a=ice-pwd)
//   fingerprint     (32-byte SHA-256, from a=fingerprint:sha-256 …)
//   candidates      (Vec<MinimalCandidate> — initial gathered candidates;
//                    later candidates trickle through `SignalingMessage.Candidates`)
export const MinimalSetupCodec = Struct({
  sdpType: SdpTypeCodec,
  sessionId: compact,
  sessionVersion: compact,
  iceUFrag: str,
  icePwd: str,
  fingerprint: Bytes(),
  candidates: Vector(MinimalCandidateCodec),
});

const OfferContent = Struct({
  // Bytes blob carrying SCALE(MinimalSetup) — NOT raw SDP text. Decoders
  // must `MinimalSetupCodec.dec` before reconstructing the SDP via the
  // canonical template (see `./sdpCoder.ts`).
  sdp: Bytes(),
});

const AnswerContent = Struct({
  sdp: Bytes(),
});

const CandidatesContent = Struct({
  // Outer Bytes — variable-length, prefixed with a SCALE compact length.
  // Inner content (after the prefix) is SCALE(`Vec<MinimalCandidate>`).
  candidates: Bytes(),
});

export const SignalingContentCodec = Enum({
  Reconnected: _void, // 0
  Offer: OfferContent, // 1
  Answer: AnswerContent, // 2
  Candidates: CandidatesContent, // 3
});

/**
 * Device-sync signaling wraps every `SignalingContent` in an envelope that
 * carries an `offerId` — a UUID that identifies the connection attempt the
 * message belongs to. Both peers correlate messages to a specific attempt
 * via this id; mismatched answers / candidates are dropped on receive,
 * which kills the stale-Answer poisoning that used to crash respawn cycles
 * after the persistent statement-store re-delivered an old Answer to the
 * fresh signaler subscription.
 *
 * Byte layout (must match Android sync's envelope byte-for-byte):
 *   offerId: SCALE String (Compact<u32> len + utf-8 bytes)
 *   message: SignalingContent enum (1-byte variant + variant body)
 *
 * `gameIndex` (used by the videogame signaling envelope) is intentionally
 * absent — device-sync is always one session per peer pair, scoped by the
 * statement-store topic, so there's no second context to disambiguate.
 */
export const SyncSignalingEnvelopeCodec = Struct({
  offerId: str,
  message: SignalingContentCodec,
});
