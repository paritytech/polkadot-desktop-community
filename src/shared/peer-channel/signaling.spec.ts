import { toHex } from 'polkadot-api/utils';
import { describe, expect, it } from 'vitest';

import {
  CandidateTypeCodec,
  IpAddressCodec,
  MinimalCandidateCodec,
  MinimalCandidatesVecCodec,
  SignalingContentCodec,
  TransportTypeCodec,
} from './signaling';

describe('SignalingContentCodec', () => {
  it('Reconnected -> discriminant 0 (1-byte tag, no payload)', () => {
    const encoded = SignalingContentCodec.enc({ tag: 'Reconnected', value: undefined });
    expect(encoded.length).toBe(1);
    expect(encoded[0]).toBe(0);
  });

  it('Offer wire layout = [tag=1][sdp_len_compact][sdp]', () => {
    const sdp = new Uint8Array(100).fill(0xaa);
    const encoded = SignalingContentCodec.enc({
      tag: 'Offer',
      value: { sdp },
    });
    expect(encoded[0]).toBe(1); // Offer
    // 100 >= 64 → SCALE compact uses 2-byte mode: ((100<<2)|0b01) = 0x0191, LE [0x91, 0x01].
    expect(encoded[1]).toBe(0x91);
    expect(encoded[2]).toBe(0x01);
    expect(encoded.length).toBe(1 + 2 + 100);
    expect(Array.from(encoded.slice(3))).toEqual(Array.from(sdp));
  });

  it('round-trips Offer with only sdp (no offerId/purpose)', () => {
    const offer = {
      tag: 'Offer' as const,
      value: { sdp: new Uint8Array([0x73, 0x64, 0x70]) },
    };
    const decoded = SignalingContentCodec.dec(SignalingContentCodec.enc(offer));
    expect(decoded.tag).toBe('Offer');
    if (decoded.tag !== 'Offer') throw new Error('unreachable');
    expect(toHex(decoded.value.sdp)).toBe('0x736470');
    expect(Object.keys(decoded.value)).toEqual(['sdp']);
  });

  it('Answer at discriminant 2, with only sdp', () => {
    const answer = {
      tag: 'Answer' as const,
      value: { sdp: new Uint8Array([1]) },
    };
    const encoded = SignalingContentCodec.enc(answer);
    expect(encoded[0]).toBe(2);
    const decoded = SignalingContentCodec.dec(encoded);
    expect(decoded.tag).toBe('Answer');
  });

  it('Candidates at discriminant 3, with candidates as a single Bytes blob (SCALE-encoded Vec<MinimalCandidate>)', () => {
    const inner = MinimalCandidatesVecCodec.enc([]);
    const encoded = SignalingContentCodec.enc({
      tag: 'Candidates',
      value: { candidates: inner },
    });
    expect(encoded[0]).toBe(3);
    // The candidates field is a single Bytes (length-prefixed). For an empty
    // inner vec, the inner content is one compact byte (0x00). The outer
    // Bytes therefore encodes 1 byte → outer length-compact = 0x04, then 0x00.
    expect(encoded[1]).toBe(0x04);
    expect(encoded[2]).toBe(0x00);
    expect(encoded.length).toBe(3);

    const decoded = SignalingContentCodec.dec(encoded);
    expect(decoded.tag).toBe('Candidates');
    if (decoded.tag !== 'Candidates') throw new Error('unreachable');
    // candidates is a Uint8Array, not an array of arrays.
    expect(decoded.value.candidates).toBeInstanceOf(Uint8Array);
    expect(MinimalCandidatesVecCodec.dec(decoded.value.candidates)).toEqual([]);
  });
});

describe('TransportTypeCodec', () => {
  it.each([
    ['TCP', 0],
    ['UDP', 1],
  ] as const)('%s -> discriminant %s', (tag, d) => {
    expect(TransportTypeCodec.enc({ tag, value: undefined })[0]).toBe(d);
  });
});

describe('CandidateTypeCodec', () => {
  it.each([
    ['HOST', 0],
    ['SRFLX', 1],
    ['RELAY', 2],
    ['PRFLX', 3],
  ] as const)('%s -> discriminant %s', (tag, d) => {
    expect(CandidateTypeCodec.enc({ tag, value: undefined })[0]).toBe(d);
  });
});

describe('IpAddressCodec', () => {
  it('Ipv4 = [0][4 bytes]', () => {
    const enc = IpAddressCodec.enc({ tag: 'Ipv4', value: Uint8Array.from([192, 168, 1, 5]) });
    expect(enc[0]).toBe(0);
    expect(enc.length).toBe(1 + 4);
    expect(Array.from(enc.slice(1))).toEqual([192, 168, 1, 5]);
  });

  it('Ipv6 = [1][16 bytes]', () => {
    const v = new Uint8Array(16).fill(0xab);
    const enc = IpAddressCodec.enc({ tag: 'Ipv6', value: v });
    expect(enc[0]).toBe(1);
    expect(enc.length).toBe(1 + 16);
  });
});

describe('MinimalCandidateCodec', () => {
  it('field order — foundation, priority(i32), transport, address, port(u16), candidateType', () => {
    const c = {
      foundation: 'a',
      priority: 1,
      transportType: { tag: 'UDP', value: undefined } as const,
      address: { tag: 'Ipv4', value: Uint8Array.from([1, 2, 3, 4]) } as const,
      port: 0x0203,
      candidateType: { tag: 'HOST', value: undefined } as const,
    };
    const enc = MinimalCandidateCodec.enc(c);
    // [str "a": 0x04 len + 0x61][i32 1 LE: 01 00 00 00][UDP: 01][Ipv4: 00 + 01 02 03 04][u16 0x0203 LE: 03 02][HOST: 00]
    expect(toHex(enc)).toBe('0x046101000000010001020304030200');
  });

  it('accepts negative priority (signed i32)', () => {
    const c = {
      foundation: '',
      priority: -1,
      transportType: { tag: 'TCP', value: undefined } as const,
      address: { tag: 'Ipv4', value: Uint8Array.from([0, 0, 0, 0]) } as const,
      port: 0,
      candidateType: { tag: 'HOST', value: undefined } as const,
    };
    const dec = MinimalCandidateCodec.dec(MinimalCandidateCodec.enc(c));
    expect(dec.priority).toBe(-1);
  });
});

describe('iceCandidates end-to-end', () => {
  it('round-trips Vec<MinimalCandidate> through the SignalingContent envelope', () => {
    const candidates = [
      {
        foundation: '12345',
        priority: 2122260223,
        transportType: { tag: 'UDP', value: undefined } as const,
        address: { tag: 'Ipv4', value: Uint8Array.from([192, 168, 1, 5]) } as const,
        port: 56789,
        candidateType: { tag: 'HOST', value: undefined } as const,
      },
      {
        foundation: 'rly1',
        priority: -1,
        transportType: { tag: 'TCP', value: undefined } as const,
        address: { tag: 'Ipv6', value: new Uint8Array(16).fill(0xab) } as const,
        port: 443,
        candidateType: { tag: 'RELAY', value: undefined } as const,
      },
    ];
    const blob = MinimalCandidatesVecCodec.enc(candidates);
    const wire = SignalingContentCodec.enc({ tag: 'Candidates', value: { candidates: blob } });

    const back = SignalingContentCodec.dec(wire);
    expect(back.tag).toBe('Candidates');
    if (back.tag !== 'Candidates') throw new Error('unreachable');
    const decoded = MinimalCandidatesVecCodec.dec(back.value.candidates);
    expect(decoded).toHaveLength(2);

    expect(decoded[0]!.foundation).toBe('12345');
    expect(decoded[0]!.priority).toBe(2122260223);
    expect(decoded[0]!.transportType.tag).toBe('UDP');
    expect(decoded[0]!.address.tag).toBe('Ipv4');
    if (decoded[0]!.address.tag !== 'Ipv4') throw new Error('unreachable');
    expect(Array.from(decoded[0]!.address.value)).toEqual([192, 168, 1, 5]);
    expect(decoded[0]!.port).toBe(56789);
    expect(decoded[0]!.candidateType.tag).toBe('HOST');

    expect(decoded[1]!.foundation).toBe('rly1');
    expect(decoded[1]!.priority).toBe(-1);
    expect(decoded[1]!.transportType.tag).toBe('TCP');
    expect(decoded[1]!.address.tag).toBe('Ipv6');
    if (decoded[1]!.address.tag !== 'Ipv6') throw new Error('unreachable');
    expect(decoded[1]!.address.value.length).toBe(16);
    expect(decoded[1]!.port).toBe(443);
    expect(decoded[1]!.candidateType.tag).toBe('RELAY');
  });
});
