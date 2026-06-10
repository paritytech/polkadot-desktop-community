import { describe, expect, it } from 'vitest';

import { minimalToRtcCandidateInit, rtcCandidateToMinimal } from './iceCandidate';

// Build a minimal RTCIceCandidate-shaped stub — the helper only reads
// foundation/priority/protocol/address/port/type so a structural mock works.
// Using a `Record` carrier keeps us out of `as RTCIceCandidate` territory and
// lets us pass intentionally-bogus protocol/type strings to exercise the
// rejection paths.
type CandidateFields = {
  foundation: string | null;
  priority: number | null;
  protocol: string | null;
  address: string | null;
  port: number | null;
  type: string | null;
};
function stub(fields: Partial<CandidateFields>): RTCIceCandidate {
  const full: CandidateFields = {
    foundation: null,
    priority: null,
    protocol: null,
    address: null,
    port: null,
    type: null,
    ...fields,
  };
  // RTCIceCandidate has a wider surface (toJSON, sdpMid, ...) — none of which
  // the helper reads. Cast through `unknown` keeps the lint rule's "no any
  // assertions" rule happy without weakening the rest of the test.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- structural mock; helper only reads the subset above
  return full as unknown as RTCIceCandidate;
}

describe('rtcCandidateToMinimal', () => {
  it('projects an IPv4 UDP host candidate', () => {
    const out = rtcCandidateToMinimal(
      stub({
        foundation: 'f1',
        priority: 2113929471,
        protocol: 'udp',
        address: '10.0.0.1',
        port: 54321,
        type: 'host',
      }),
    );
    expect(out).not.toBeNull();
    if (!out) throw new Error();
    expect(out.foundation).toBe('f1');
    expect(out.priority).toBe(2113929471);
    expect(out.transportType.tag).toBe('UDP');
    expect(out.address.tag).toBe('Ipv4');
    if (out.address.tag !== 'Ipv4') throw new Error();
    expect(Array.from(out.address.value)).toEqual([10, 0, 0, 1]);
    expect(out.port).toBe(54321);
    expect(out.candidateType.tag).toBe('HOST');
  });

  it('projects an IPv6 TCP relay candidate (handles :: shorthand)', () => {
    const out = rtcCandidateToMinimal(
      stub({
        foundation: 'r',
        priority: 1000,
        protocol: 'tcp',
        address: '2001:db8::1',
        port: 443,
        type: 'relay',
      }),
    );
    expect(out).not.toBeNull();
    if (!out) throw new Error();
    expect(out.transportType.tag).toBe('TCP');
    expect(out.address.tag).toBe('Ipv6');
    if (out.address.tag !== 'Ipv6') throw new Error();
    // 2001:db8::1 = [0x2001, 0x0db8, 0, 0, 0, 0, 0, 0x0001] in LE u16 → bytes:
    // [0x01, 0x20, 0xb8, 0x0d, 0,0, 0,0, 0,0, 0,0, 0,0, 0x01, 0x00].
    expect(Array.from(out.address.value)).toEqual([0x01, 0x20, 0xb8, 0x0d, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x01, 0x00]);
    expect(out.candidateType.tag).toBe('RELAY');
  });

  it('drops mDNS hostnames (.local)', () => {
    const out = rtcCandidateToMinimal(
      stub({
        foundation: 'm',
        priority: 1,
        protocol: 'udp',
        address: 'abcd-1234.local',
        port: 1,
        type: 'host',
      }),
    );
    expect(out).toBeNull();
  });

  it('drops candidates with unknown transport/type', () => {
    expect(
      rtcCandidateToMinimal(stub({ foundation: '', priority: 0, protocol: 'ssltcp', address: '1.2.3.4', port: 1, type: 'host' })),
    ).toBeNull();
    expect(
      rtcCandidateToMinimal(stub({ foundation: '', priority: 0, protocol: 'udp', address: '1.2.3.4', port: 1, type: 'mystery' })),
    ).toBeNull();
  });
});

describe('minimalToRtcCandidateInit', () => {
  it('builds a parseable SDP attribute (IPv4 host)', () => {
    const init = minimalToRtcCandidateInit({
      foundation: 'f1',
      priority: 1234,
      transportType: { tag: 'UDP', value: undefined },
      address: { tag: 'Ipv4', value: Uint8Array.from([10, 0, 0, 1]) },
      port: 5000,
      candidateType: { tag: 'HOST', value: undefined },
    });
    expect(init.candidate).toBe('candidate:f1 1 udp 1234 10.0.0.1 5000 typ host');
    expect(init.sdpMid).toBe('0');
    expect(init.sdpMLineIndex).toBe(0);
  });
});
