import { toHex } from 'polkadot-api/utils';
import { describe, expect, it } from 'vitest';

import { DEVICE_SYNC_USE_CASE_ID, DataChannelMessageCodec } from './dataChannelEnvelope';

describe('DataChannelMessageCodec', () => {
  it('round-trips an envelope { id, data }', () => {
    const envelope = {
      id: DEVICE_SYNC_USE_CASE_ID,
      data: new Uint8Array([1, 2, 3, 4]),
    };
    const decoded = DataChannelMessageCodec.dec(DataChannelMessageCodec.enc(envelope));
    expect(decoded.id).toBe(DEVICE_SYNC_USE_CASE_ID);
    expect(Array.from(decoded.data)).toEqual([1, 2, 3, 4]);
  });

  // Byte-layout assertion against Android's `DataChannelMessage = { id: String, data: ByteArray }`.
  // SCALE-encoded:
  //   id:   compact-len("device-sync") = 0x2c (= 11 << 2), then 11 ASCII bytes
  //   data: compact-len(4) = 0x10 (= 4 << 2), then 4 raw bytes
  // Total 1 + 11 + 1 + 4 = 17 bytes.
  it('byte layout matches Android wire (compact str + compact bytes)', () => {
    const enc = DataChannelMessageCodec.enc({
      id: 'device-sync',
      data: new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]),
    });
    expect(toHex(enc)).toBe('0x2c6465766963652d73796e6310aabbccdd');
  });
});
