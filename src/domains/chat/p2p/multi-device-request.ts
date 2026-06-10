/**
 * Pure assembly helper for the multi-device chat-request envelope.
 *
 *   encryptedRequest  = encrypt(oneShotKey, Request)
 *   encryptedResponse = encrypt(oneShotKey, Response)
 *   RequestDeviceInfo.encryptedKey = ECDH-wrap(oneShotKey, senderDevicePriv × recipientDevicePub)
 *
 * The sender's persistent device pubkey is NOT carried on the envelope —
 * receivers look it up from `Contact.devices[]` (populated via roster events).
 * Each recipient derives the same ECDH shared secret from `senderDevicePub +
 * their device private key`, unwraps its `encryptedKey` to recover the one-shot
 * key, and decrypts the payload.
 *
 * The symmetric encryption (`encryptSymmetric`) and per-device key wrap
 * (`wrapKey`) are accepted as parameters so the assembly logic stays decoupled
 * from cipher choices — concrete defaults live in `multi-device-crypto.ts`.
 */

import { type CodecType } from 'scale-ts';

import { type MultiDeviceRequest, type MultiDeviceResponse } from './chatRequestCodec';

export type DeviceTarget = {
  statementAccountId: Uint8Array;
  encryptionPublicKey: Uint8Array;
};

export type SymmetricEncrypt = (key: Uint8Array, plaintext: Uint8Array) => Uint8Array;
// Per-recipient wrap: given the sender's persistent device private key and the
// recipient device's encryption pubkey, return the bytes that go in
// `RequestDeviceInfo.encryptedKey`.
export type KeyWrap = (
  senderDevicePrivateKey: Uint8Array,
  recipientEncryptionPublicKey: Uint8Array,
  oneShotKey: Uint8Array,
) => Uint8Array;

const wrapPerDevice = (
  recipients: DeviceTarget[],
  senderDevicePrivateKey: Uint8Array,
  oneShotKey: Uint8Array,
  wrapKey: KeyWrap,
) =>
  recipients.map(r => ({
    statementAccountId: r.statementAccountId,
    encryptedKey: wrapKey(senderDevicePrivateKey, r.encryptionPublicKey, oneShotKey),
  }));

export const buildMultiDeviceRequest = (params: {
  request: Uint8Array;
  recipients: DeviceTarget[];
  oneShotKey: Uint8Array;
  senderDevicePrivateKey: Uint8Array;
  encryptSymmetric: SymmetricEncrypt;
  wrapKey: KeyWrap;
}): CodecType<typeof MultiDeviceRequest> => ({
  encryptedRequest: params.encryptSymmetric(params.oneShotKey, params.request),
  devicesInfo: wrapPerDevice(params.recipients, params.senderDevicePrivateKey, params.oneShotKey, params.wrapKey),
});

export const buildMultiDeviceResponse = (params: {
  response: Uint8Array;
  recipients: DeviceTarget[];
  oneShotKey: Uint8Array;
  senderDevicePrivateKey: Uint8Array;
  encryptSymmetric: SymmetricEncrypt;
  wrapKey: KeyWrap;
}): CodecType<typeof MultiDeviceResponse> => ({
  encryptedResponse: params.encryptSymmetric(params.oneShotKey, params.response),
  devicesInfo: wrapPerDevice(params.recipients, params.senderDevicePrivateKey, params.oneShotKey, params.wrapKey),
});
