import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mapSdkContent, mapUiContentToSdk } from './contentMappers';

describe('contentMappers — coinage / send / call signals', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('mapSdkContent', () => {
    it('decodes coinagePayment as transfer (coinage)', () => {
      const out = mapSdkContent({
        tag: 'coinagePayment',
        value: { totalValue: 1_500_000_000_000n, coinKeys: [] },
      });
      expect(out).toEqual({ type: 'transfer', kind: 'coinage', amount: 1_500_000_000_000n });
    });

    it('decodes send (native) — assetId is null', () => {
      const blockHash = new Uint8Array(32).fill(0xaa);
      const extrinsicHash = new Uint8Array(32).fill(0xbb);
      const out = mapSdkContent({
        tag: 'send',
        value: { amount: 250n, assetId: null, blockHash, extrinsicHash },
      });
      expect(out).toEqual({
        type: 'transfer',
        kind: 'legacy',
        amount: 250n,
        assetId: null,
        blockHash,
        extrinsicHash,
      });
    });

    it('decodes send (asset) — preserves hex assetId', () => {
      const out = mapSdkContent({
        tag: 'send',
        value: { amount: 1n, assetId: '0xdeadbeef' },
      });
      expect(out).toMatchObject({ type: 'transfer', kind: 'legacy', amount: 1n, assetId: '0xdeadbeef' });
    });

    it('decodes dataChannelOffer (audio) with bare-string purpose', () => {
      expect(mapSdkContent({ tag: 'dataChannelOffer', value: { sdp: new Uint8Array(), purpose: 'AUDIO_CALL' } })).toEqual({
        type: 'callSignal',
        signal: 'offer',
        purpose: 'audio',
      });
    });

    it('decodes dataChannelOffer (video) with { tag, value } purpose', () => {
      expect(
        mapSdkContent({
          tag: 'dataChannelOffer',
          value: { sdp: new Uint8Array(), purpose: { tag: 'VIDEO_CALL', value: undefined } },
        }),
      ).toEqual({ type: 'callSignal', signal: 'offer', purpose: 'video' });
    });

    it('decodes dataChannelAnswer / ice / closed and preserves offerMessageId', () => {
      const value = { offerMessageId: 'offer-42', sdp: new Uint8Array() };
      expect(mapSdkContent({ tag: 'dataChannelAnswer', value })).toEqual({
        type: 'callSignal',
        signal: 'answer',
        offerMessageId: 'offer-42',
      });
      expect(mapSdkContent({ tag: 'dataChannelIceCandidate', value })).toEqual({
        type: 'callSignal',
        signal: 'ice',
        offerMessageId: 'offer-42',
      });
      expect(mapSdkContent({ tag: 'dataChannelClosed', value: { offerMessageId: 'offer-42' } })).toEqual({
        type: 'callSignal',
        signal: 'closed',
        offerMessageId: 'offer-42',
      });
    });

    it('rejects a coinage payment payload missing totalValue', () => {
      expect(mapSdkContent({ tag: 'coinagePayment', value: { coinKeys: [] } })).toBeNull();
    });

    it('rejects an offer with unknown purpose', () => {
      expect(mapSdkContent({ tag: 'dataChannelOffer', value: { sdp: new Uint8Array(), purpose: 'MYSTERY' } })).toBeNull();
    });

    it('still warns + returns null on an unrecognised tag', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(mapSdkContent({ tag: 'mysteryTag', value: undefined })).toBeNull();
      expect(warn).toHaveBeenCalledWith('[chat-content-mappers] Unknown SDK content tag:', 'mysteryTag');
    });
  });

  describe('mapUiContentToSdk', () => {
    it('returns null for transfer (desktop never sends)', () => {
      expect(mapUiContentToSdk({ type: 'transfer', kind: 'coinage', amount: 1n })).toBeNull();
    });

    it('returns null for callSignal (desktop never sends)', () => {
      expect(mapUiContentToSdk({ type: 'callSignal', signal: 'offer', purpose: 'audio' })).toBeNull();
    });
  });
});
