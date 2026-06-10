import { beforeAll, describe, expect, it, vi } from 'vitest';

import { createPeerConnection } from './peerConnection';

class FakeDataChannel extends EventTarget {
  readyState: RTCDataChannelState = 'connecting';
  label: string;
  send = vi.fn();
  close = vi.fn();
  constructor(label: string) {
    super();
    this.label = label;
  }
  open(): void {
    this.readyState = 'open';
    this.dispatchEvent(new Event('open'));
  }
}

class FakePeerConnection extends EventTarget {
  localDescription: RTCSessionDescription | null = null;
  remoteDescription: RTCSessionDescription | null = null;
  signalingState: RTCSignalingState = 'stable';
  iceConnectionState: RTCIceConnectionState = 'new';
  channel?: FakeDataChannel;
  createDataChannel(label: string): FakeDataChannel {
    this.channel = new FakeDataChannel(label);
    return this.channel;
  }
  createOffer = vi.fn(async () => ({ type: 'offer' as const, sdp: 'fake-offer-sdp' }));
  createAnswer = vi.fn(async () => ({ type: 'answer' as const, sdp: 'fake-answer-sdp' }));
  setLocalDescription = vi.fn(async (d: RTCSessionDescriptionInit) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- fake mirrors lib.dom shape; init covers the surface used in tests
    this.localDescription = d as RTCSessionDescription;
  });
  setRemoteDescription = vi.fn(async (d: RTCSessionDescriptionInit) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- fake mirrors lib.dom shape; init covers the surface used in tests
    this.remoteDescription = d as RTCSessionDescription;
    if (d.type === 'offer') {
      const channel = new FakeDataChannel('sync');
      this.channel = channel;
      this.dispatchEvent(Object.assign(new Event('datachannel'), { channel }));
    }
  });
  addIceCandidate = vi.fn(async () => {});
  close = vi.fn();
}

beforeAll(() => {
  // @ts-expect-error inject fake into globals
  globalThis.RTCPeerConnection = FakePeerConnection;
});

describe('createPeerConnection (initiator)', () => {
  it('creates an offer', async () => {
    const conn = createPeerConnection({ role: 'initiator', dataChannelLabel: 'sync', iceConfig: {} });
    const offer = await conn.createOffer();
    expect(offer.sdp).toBe('fake-offer-sdp');
  });
});

describe('createPeerConnection (acceptor)', () => {
  it('produces an answer after applying an offer', async () => {
    const conn = createPeerConnection({ role: 'acceptor', dataChannelLabel: 'sync', iceConfig: {} });
    await conn.applyRemoteOffer({ type: 'offer', sdp: 'remote-offer' });
    const answer = await conn.createAnswer();
    expect(answer.sdp).toBe('fake-answer-sdp');
  });
});
