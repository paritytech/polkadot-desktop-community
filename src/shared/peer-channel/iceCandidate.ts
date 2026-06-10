/**
 * RTCIceCandidate ↔ MinimalCandidate (cross-platform SCALE) translation.
 * MinimalCandidate keeps only what survives non-WebRTC reparsing back to SDP;
 * mDNS / TURN extras / tcptype / generation drop at the wire. Unrepresentable
 * candidates return `null` and are skipped (treated as still-trickling).
 */

import { type CodecType } from 'scale-ts';

import { type MinimalCandidateCodec } from './signaling';

export type MinimalCandidate = CodecType<typeof MinimalCandidateCodec>;

function ipv4ToBytes(addr: string): Uint8Array | null {
  const parts = addr.split('.');
  if (parts.length !== 4) return null;
  const out = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    const n = Number(parts[i]);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    out[i] = n;
  }
  return out;
}

function bytesToIpv4(bytes: Uint8Array): string {
  return Array.from(bytes).join('.');
}

/**
 * Expand "::"-shorthand IPv6 into 8 explicit hextets, then serialise each as a
 * little-endian u16 (SCALE encoding for `u16`). 0-prefix hextets keep their
 * canonical zero-pad; the wire byte order ends up low-byte-first per hextet —
 * not network byte order, but it matches Android's `UShort` SCALE encoding.
 */
function ipv6ToBytes(addr: string): Uint8Array | null {
  // Strip a zone id if present (e.g. "fe80::1%eth0") — not part of the wire.
  const cleaned = addr.split('%')[0] ?? addr;
  let head: string[] = [];
  let tail: string[] = [];
  if (cleaned.includes('::')) {
    const [h, t] = cleaned.split('::');
    head = h ? h.split(':') : [];
    tail = t ? t.split(':') : [];
    if (head.length + tail.length > 8) return null;
  } else {
    head = cleaned.split(':');
    if (head.length !== 8) return null;
  }
  const zeros = Array<string>(8 - head.length - tail.length).fill('0');
  const parts = [...head, ...zeros, ...tail];
  if (parts.length !== 8) return null;

  const out = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    const hextet = parts[i] ?? '';
    if (!/^[0-9a-fA-F]{1,4}$/.test(hextet)) return null;
    const v = parseInt(hextet, 16);
    out[i * 2] = v & 0xff; // LE: low byte first
    out[i * 2 + 1] = (v >> 8) & 0xff;
  }
  return out;
}

function bytesToIpv6(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const lo = bytes[i * 2] ?? 0;
    const hi = bytes[i * 2 + 1] ?? 0;
    const v = lo | (hi << 8);
    parts.push(v.toString(16));
  }
  return parts.join(':');
}

const TYPE_TAGS: Record<string, MinimalCandidate['candidateType']['tag'] | undefined> = {
  host: 'HOST',
  srflx: 'SRFLX',
  relay: 'RELAY',
  prflx: 'PRFLX',
};

export function rtcCandidateToMinimal(c: RTCIceCandidate): MinimalCandidate | null {
  const proto = (c.protocol ?? '').toLowerCase();
  if (proto !== 'udp' && proto !== 'tcp') return null;
  const transportType =
    proto === 'udp' ? ({ tag: 'UDP', value: undefined } as const) : ({ tag: 'TCP', value: undefined } as const);

  const rawAddr = c.address ?? '';
  if (!rawAddr) return null;

  let address: MinimalCandidate['address'];
  if (rawAddr.includes(':')) {
    const v = ipv6ToBytes(rawAddr);
    if (!v) return null;
    address = { tag: 'Ipv6', value: v };
  } else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(rawAddr)) {
    const v = ipv4ToBytes(rawAddr);
    if (!v) return null;
    address = { tag: 'Ipv4', value: v };
  } else {
    // mDNS-style hostname ("abcd-...-local") or other non-IP form — drop.
    return null;
  }

  const typ = (c.type ?? '').toLowerCase();
  const typeTag = TYPE_TAGS[typ];
  if (!typeTag) return null;

  return {
    foundation: c.foundation ?? '',
    priority: c.priority ?? 0,
    transportType,
    address,
    port: c.port ?? 0,
    candidateType: { tag: typeTag, value: undefined },
  };
}

export function minimalToRtcCandidateInit(m: MinimalCandidate): RTCIceCandidateInit {
  const proto = m.transportType.tag === 'UDP' ? 'udp' : 'tcp';
  const addr = m.address.tag === 'Ipv4' ? bytesToIpv4(m.address.value) : bytesToIpv6(m.address.value);
  const typ = m.candidateType.tag.toLowerCase();
  // Component id defaults to 1 (RTP) — the only component used by sync data
  // channels. sdpMid / sdpMLineIndex default to the single-m-line case.
  const sdp = `candidate:${m.foundation} 1 ${proto} ${m.priority} ${addr} ${m.port} typ ${typ}`;
  return { candidate: sdp, sdpMid: '0', sdpMLineIndex: 0 };
}
