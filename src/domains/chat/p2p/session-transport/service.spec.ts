import { beforeEach, describe, expect, it, vi } from 'vitest';

import { chatContentService } from './service';

const BLURHASH = 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH';

describe('chatContentService — file meta blurhash', () => {
  const imageWire = (thumbnail?: Uint8Array | null) => ({
    tag: 'image',
    value: { general: { mimeType: 'image/png', fileSize: 1000 }, width: 100, height: 80, thumbnail },
  });
  const videoWire = (thumbnail?: Uint8Array | null) => ({
    tag: 'video',
    value: { general: { mimeType: 'video/mp4', fileSize: 4096 }, duration: 30, thumbnail },
  });

  it('decodes the image thumbnail bytes to a blurhash string', () => {
    const out = chatContentService.mapFileMeta(imageWire(new TextEncoder().encode(BLURHASH)));
    expect(out).toMatchObject({ type: 'image', blurhash: BLURHASH });
  });

  it('decodes the video thumbnail bytes to a blurhash string', () => {
    const out = chatContentService.mapFileMeta(videoWire(new TextEncoder().encode(BLURHASH)));
    expect(out).toMatchObject({ type: 'video', blurhash: BLURHASH });
  });

  it.each([
    ['absent', undefined],
    ['null', null],
    ['empty', new Uint8Array()],
  ])('leaves blurhash unset when the thumbnail is %s', (_label, thumbnail) => {
    const out = chatContentService.mapFileMeta(imageWire(thumbnail));
    expect(out?.type === 'image' ? out.blurhash : 'unexpected-type').toBeUndefined();
  });

  it('rejects an oversized thumbnail instead of decoding it', () => {
    const out = chatContentService.mapFileMeta(imageWire(new Uint8Array(257).fill(0x61)));
    expect(out?.type === 'image' ? out.blurhash : 'unexpected-type').toBeUndefined();
  });

  type WireRichText = { attachments: { value: { meta: { value: { thumbnail?: Uint8Array } } } }[] };
  const firstThumbnail = (out: { value: unknown } | null): Uint8Array | undefined =>
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test reaches into the opaque {tag,value} wire shape
    (out!.value as WireRichText).attachments[0]!.value.meta.value.thumbnail;

  it('round-trips the blurhash back onto the wire thumbnail', () => {
    const out = chatContentService.mapUiContentToSdk({
      type: 'richText',
      attachments: [
        {
          identifier: new Uint8Array([1]),
          claimTicket: new Uint8Array([2]),
          meta: { type: 'image', mimeType: 'image/png', fileSize: 1000, width: 100, height: 80, blurhash: BLURHASH },
        },
      ],
    });

    const thumbnail = firstThumbnail(out);
    expect(thumbnail).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(thumbnail)).toBe(BLURHASH);
  });

  it('writes no thumbnail when the attachment has no blurhash', () => {
    const out = chatContentService.mapUiContentToSdk({
      type: 'richText',
      attachments: [
        {
          identifier: new Uint8Array([1]),
          claimTicket: new Uint8Array([2]),
          meta: { type: 'video', mimeType: 'video/mp4', fileSize: 4096, duration: 30 },
        },
      ],
    });

    expect(firstThumbnail(out)).toBeUndefined();
  });
});

describe('contentMappers — coinage / send / call signals', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('mapSdkContent', () => {
    it('decodes coinagePayment as transfer (coinage)', () => {
      const out = chatContentService.mapSdkContent({
        tag: 'coinagePayment',
        value: { totalValue: 1_500_000_000_000n, coinKeys: [] },
      });
      expect(out).toEqual({ type: 'transfer', kind: 'coinage', amount: 1_500_000_000_000n });
    });

    it('decodes send (native) — assetId is null', () => {
      const blockHash = new Uint8Array(32).fill(0xaa);
      const extrinsicHash = new Uint8Array(32).fill(0xbb);
      const out = chatContentService.mapSdkContent({
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
      const out = chatContentService.mapSdkContent({
        tag: 'send',
        value: { amount: 1n, assetId: '0xdeadbeef' },
      });
      expect(out).toMatchObject({ type: 'transfer', kind: 'legacy', amount: 1n, assetId: '0xdeadbeef' });
    });

    it('decodes dataChannelOffer (audio) with bare-string purpose', () => {
      expect(
        chatContentService.mapSdkContent({ tag: 'dataChannelOffer', value: { sdp: new Uint8Array(), purpose: 'AUDIO_CALL' } }),
      ).toEqual({
        type: 'callSignal',
        signal: 'offer',
        purpose: 'audio',
      });
    });

    it('decodes dataChannelOffer (video) with { tag, value } purpose', () => {
      expect(
        chatContentService.mapSdkContent({
          tag: 'dataChannelOffer',
          value: { sdp: new Uint8Array(), purpose: { tag: 'VIDEO_CALL', value: undefined } },
        }),
      ).toEqual({ type: 'callSignal', signal: 'offer', purpose: 'video' });
    });

    it('decodes dataChannelAnswer / ice / closed and preserves offerMessageId', () => {
      const value = { offerMessageId: 'offer-42', sdp: new Uint8Array() };
      expect(chatContentService.mapSdkContent({ tag: 'dataChannelAnswer', value })).toEqual({
        type: 'callSignal',
        signal: 'answer',
        offerMessageId: 'offer-42',
      });
      expect(chatContentService.mapSdkContent({ tag: 'dataChannelIceCandidate', value })).toEqual({
        type: 'callSignal',
        signal: 'ice',
        offerMessageId: 'offer-42',
      });
      expect(chatContentService.mapSdkContent({ tag: 'dataChannelClosed', value: { offerMessageId: 'offer-42' } })).toEqual({
        type: 'callSignal',
        signal: 'closed',
        offerMessageId: 'offer-42',
      });
    });

    it('rejects a coinage payment payload missing totalValue', () => {
      expect(chatContentService.mapSdkContent({ tag: 'coinagePayment', value: { coinKeys: [] } })).toBeNull();
    });

    it('rejects an offer with unknown purpose', () => {
      expect(
        chatContentService.mapSdkContent({ tag: 'dataChannelOffer', value: { sdp: new Uint8Array(), purpose: 'MYSTERY' } }),
      ).toBeNull();
    });

    it('still warns + returns null on an unrecognised tag', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(chatContentService.mapSdkContent({ tag: 'mysteryTag', value: undefined })).toBeNull();
      expect(warn).toHaveBeenCalledWith('[chat-content-mappers] Unknown SDK content tag:', 'mysteryTag');
    });
  });

  describe('mapUiContentToSdk', () => {
    it('returns null for transfer (desktop never sends)', () => {
      expect(chatContentService.mapUiContentToSdk({ type: 'transfer', kind: 'coinage', amount: 1n })).toBeNull();
    });

    it('returns null for callSignal (desktop never sends)', () => {
      expect(chatContentService.mapUiContentToSdk({ type: 'callSignal', signal: 'offer', purpose: 'audio' })).toBeNull();
    });
  });
});
