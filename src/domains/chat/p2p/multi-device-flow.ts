/**
 * High-level send/receive primitives for the V2 multi-device chat envelope.
 *
 * Composes the codec (`chatRequestCodec.MultiDeviceRequest`), the per-device
 * key wrap (`multi-device-crypto.wrapOneShotKey`), and the AES-GCM inner
 * layer (`aesGcmEncrypt`/`aesGcmDecrypt`) into a single round-trip pair.
 *
 * Symmetric flow:
 *   encryptForRecipients(plaintext, recipients, senderDevicePrivKey) → { data, oneShotKey }
 *   decryptForOwnDevice(data, ownStatementAccountId, ownDevicePrivKey, senderDevicePubKey) → plaintext
 *
 * Both sides use their persistent SSO V2 device keypair (no ephemeral).
 * The receiver looks up `senderDevicePubKey` in its `Contact.devices[]`.
 */

import { StructuredStatementData } from './chatRequestCodec';
import { aesGcmDecrypt, aesGcmEncrypt, generateOneShotKey, unwrapOneShotKey, wrapOneShotKey } from './multi-device-crypto';
import { type DeviceTarget, buildMultiDeviceRequest, buildMultiDeviceResponse } from './multi-device-request';

const equalAccountId = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

export type EncryptForRecipientsResult = {
  data: Uint8Array;
  oneShotKey: Uint8Array;
};

/**
 * Encrypt `plaintext` for delivery to N recipient devices.
 *
 * Uses the sender's persistent device keypair (from SSO V2 handshake) for
 * per-recipient ECDH wrap. Returns wire bytes wrapped in
 * `StructuredStatementData::MultiRequest` (discriminant 2) ready to put on
 * the statement's `data` field, plus the one-shot symmetric key (exposed for
 * tests and for callers that need it).
 */
export const encryptForRecipients = (
  plaintext: Uint8Array,
  recipients: DeviceTarget[],
  senderDevicePrivateKey: Uint8Array,
): EncryptForRecipientsResult => {
  const oneShotKey = generateOneShotKey();

  const request = buildMultiDeviceRequest({
    request: plaintext,
    recipients,
    oneShotKey,
    senderDevicePrivateKey,
    encryptSymmetric: aesGcmEncrypt,
    wrapKey: wrapOneShotKey,
  });

  return {
    data: StructuredStatementData.enc({ tag: 'MultiRequest', value: request }),
    oneShotKey,
  };
};

/**
 * Mirror of `encryptForRecipients` for the response side. Wire bytes are
 * wrapped in `StructuredStatementData::MultiResponse` (discriminant 3).
 */
export const encryptResponseForRecipients = (
  plaintext: Uint8Array,
  recipients: DeviceTarget[],
  senderDevicePrivateKey: Uint8Array,
): EncryptForRecipientsResult => {
  const oneShotKey = generateOneShotKey();

  const response = buildMultiDeviceResponse({
    response: plaintext,
    recipients,
    oneShotKey,
    senderDevicePrivateKey,
    encryptSymmetric: aesGcmEncrypt,
    wrapKey: wrapOneShotKey,
  });

  return {
    data: StructuredStatementData.enc({ tag: 'MultiResponse', value: response }),
    oneShotKey,
  };
};

/**
 * Decrypt a wire-format `MultiDeviceRequest` for the recipient device
 * whose statementAccountId is `ownStatementAccountId`. The sender's device
 * pubkey must come from `Contact.devices[]` — it is not on the wire.
 *
 * Returns null if:
 *   - the payload doesn't decode as MultiDeviceRequest
 *   - this device's account isn't in `devicesInfo`
 *   - the per-device key unwrap fails (auth tag mismatch — sender mismatch)
 *   - the inner symmetric decrypt fails
 */
export const decryptForOwnDevice = (
  data: Uint8Array,
  ownStatementAccountId: Uint8Array,
  ownEncryptionPrivateKey: Uint8Array,
  senderEncryptionPublicKey: Uint8Array,
): Uint8Array | null => {
  let outer: ReturnType<typeof StructuredStatementData.dec>;
  try {
    outer = StructuredStatementData.dec(data);
  } catch {
    return null;
  }
  if (outer.tag !== 'MultiRequest') return null;
  const envelope = outer.value;

  const ownEntry = envelope.devicesInfo.find(d => equalAccountId(d.statementAccountId, ownStatementAccountId));
  if (!ownEntry) return null;

  let oneShotKey: Uint8Array;
  try {
    oneShotKey = unwrapOneShotKey(ownEncryptionPrivateKey, senderEncryptionPublicKey, ownEntry.encryptedKey);
  } catch {
    return null;
  }

  try {
    return aesGcmDecrypt(oneShotKey, envelope.encryptedRequest);
  } catch {
    return null;
  }
};

/**
 * Mirror for the response side.
 */
export const decryptResponseForOwnDevice = (
  data: Uint8Array,
  ownStatementAccountId: Uint8Array,
  ownEncryptionPrivateKey: Uint8Array,
  senderEncryptionPublicKey: Uint8Array,
): Uint8Array | null => {
  let outer: ReturnType<typeof StructuredStatementData.dec>;
  try {
    outer = StructuredStatementData.dec(data);
  } catch {
    return null;
  }
  if (outer.tag !== 'MultiResponse') return null;
  const envelope = outer.value;

  const ownEntry = envelope.devicesInfo.find(d => equalAccountId(d.statementAccountId, ownStatementAccountId));
  if (!ownEntry) return null;

  let oneShotKey: Uint8Array;
  try {
    oneShotKey = unwrapOneShotKey(ownEncryptionPrivateKey, senderEncryptionPublicKey, ownEntry.encryptedKey);
  } catch {
    return null;
  }

  try {
    return aesGcmDecrypt(oneShotKey, envelope.encryptedResponse);
  } catch {
    return null;
  }
};
