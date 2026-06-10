/**
 * Data-channel multiplexing envelope. Parity with Android's
 * `DataChannelMessage.kt`: `{ id: String, data: Bytes }`. `id` is the
 * use-case key; receivers route by exact-string match.
 */

import { Bytes, Struct, str } from 'scale-ts';

export const DataChannelMessageCodec = Struct({
  id: str,
  data: Bytes(),
});

export const DEVICE_SYNC_USE_CASE_ID = 'device-sync';
