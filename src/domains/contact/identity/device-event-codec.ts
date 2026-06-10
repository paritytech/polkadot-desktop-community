/**
 * SCALE codecs for the device roster events that contacts broadcast when
 * they pair or unpair a device.
 *
 * Per the spec's "Device Registration Process" / "Device Removal": events are
 * fanned out to all contacts so each peer can keep its `Contact.devices[]` list
 * current.
 *
 * Wire format mirrors the spec literally:
 *   DeviceAdded   { statementAccountId, encryptionPublicKey }
 *   DeviceRemoved { statementAccountId }
 *
 * `DeviceRosterEvent` is the discriminated wrapper used when both events
 * share a topic; consumers can also decode each variant independently if
 * the transport already separates them.
 */

import { Bytes, Enum, Struct } from 'scale-ts';

const AccountIdCodec = Bytes(32);
const PublicKeyCodec = Bytes(65);

export const DeviceAdded = Struct({
  statementAccountId: AccountIdCodec,
  encryptionPublicKey: PublicKeyCodec,
});

export const DeviceRemoved = Struct({
  statementAccountId: AccountIdCodec,
});

export const DeviceRosterEvent = Enum({
  DeviceAdded,
  DeviceRemoved,
});
