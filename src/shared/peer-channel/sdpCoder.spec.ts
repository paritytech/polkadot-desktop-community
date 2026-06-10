import { describe, expect, it } from 'vitest';

import { decodeMinimalSetup, encodeMinimalSetup } from './sdpCoder';
import { MinimalSetupCodec } from './signaling';

// Stub SDP that exercises every field `parseSdpBase` extracts. Whitespace and
// CRLF/LF mix matches what Chromium emits.
const SAMPLE_LOCAL_OFFER_SDP =
  'v=0\r\n' +
  'o=- 1234567890123456789 7 IN IP4 0.0.0.0\r\n' +
  's=-\r\n' +
  't=0 0\r\n' +
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n' +
  'c=IN IP4 0.0.0.0\r\n' +
  'a=ice-ufrag:abcd\r\n' +
  'a=ice-pwd:passwordabcdefghijkl0123\r\n' +
  'a=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99\r\n' +
  'a=setup:actpass\r\n' +
  'a=mid:0\r\n' +
  'a=sctp-port:5000\r\n';

describe('encodeMinimalSetup', () => {
  it('extracts every canonical field from a Chromium-style offer SDP', () => {
    const bytes = encodeMinimalSetup(SAMPLE_LOCAL_OFFER_SDP);
    const decoded = MinimalSetupCodec.dec(bytes);
    expect(decoded.sdpType.tag).toBe('OFFER');
    // scale-ts `compact` returns `number` for values that fit in a JS
    // safe-integer slot and `bigint` for larger ones. Normalise both ends
    // so the roundtrip assertion doesn't care which path was taken.
    expect(BigInt(decoded.sessionId)).toBe(1234567890123456789n);
    expect(BigInt(decoded.sessionVersion)).toBe(7n);
    expect(decoded.iceUFrag).toBe('abcd');
    expect(decoded.icePwd).toBe('passwordabcdefghijkl0123');
    expect(decoded.fingerprint.length).toBe(32);
    expect(decoded.fingerprint[0]).toBe(0xaa);
    expect(decoded.fingerprint[1]).toBe(0xbb);
    expect(decoded.fingerprint[31]).toBe(0x99);
    expect(decoded.candidates).toEqual([]);
  });

  it('marks `a=setup:active` as ANSWER, `a=setup:actpass` as OFFER', () => {
    const offer = encodeMinimalSetup(SAMPLE_LOCAL_OFFER_SDP);
    expect(MinimalSetupCodec.dec(offer).sdpType.tag).toBe('OFFER');

    const answer = encodeMinimalSetup(SAMPLE_LOCAL_OFFER_SDP.replace('a=setup:actpass', 'a=setup:active'));
    expect(MinimalSetupCodec.dec(answer).sdpType.tag).toBe('ANSWER');
  });
});

describe('decodeMinimalSetup', () => {
  it('reconstructs an SDP that contains every input field', () => {
    const bytes = encodeMinimalSetup(SAMPLE_LOCAL_OFFER_SDP);
    const { setupSdp, candidates } = decodeMinimalSetup(bytes);

    expect(candidates).toEqual([]);
    expect(setupSdp).toContain('v=0');
    expect(setupSdp).toContain('o=- 1234567890123456789 7 IN IP4 0.0.0.0');
    expect(setupSdp).toContain('m=application 9 UDP/DTLS/SCTP webrtc-datachannel');
    expect(setupSdp).toContain('a=ice-ufrag:abcd');
    expect(setupSdp).toContain('a=ice-pwd:passwordabcdefghijkl0123');
    expect(setupSdp).toContain(
      'a=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99',
    );
    expect(setupSdp).toContain('a=setup:actpass');
    expect(setupSdp).toContain('a=mid:0');
    expect(setupSdp).toContain('a=sctp-port:5000');
  });

  it('answer SDP gets `a=setup:active` (matching Android)', () => {
    const answerBytes = encodeMinimalSetup(SAMPLE_LOCAL_OFFER_SDP.replace('a=setup:actpass', 'a=setup:active'));
    const { setupSdp } = decodeMinimalSetup(answerBytes);
    expect(setupSdp).toContain('a=setup:active');
  });

  it('round-trips initial-candidate batch inside MinimalSetup', () => {
    // Build a MinimalSetup with one IPv4 host candidate manually and ensure
    // decodeMinimalSetup yields a valid RTCIceCandidateInit.
    const setupBytes = MinimalSetupCodec.enc({
      sdpType: { tag: 'OFFER', value: undefined },
      sessionId: 1n,
      sessionVersion: 1n,
      iceUFrag: 'x',
      icePwd: 'y',
      fingerprint: new Uint8Array(32).fill(0x11),
      candidates: [
        {
          foundation: '1',
          priority: 1000,
          transportType: { tag: 'UDP', value: undefined },
          address: { tag: 'Ipv4', value: Uint8Array.from([10, 0, 0, 1]) },
          port: 5000,
          candidateType: { tag: 'HOST', value: undefined },
        },
      ],
    });
    const { candidates } = decodeMinimalSetup(setupBytes);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.candidate).toBe('candidate:1 1 udp 1000 10.0.0.1 5000 typ host');
  });
});
