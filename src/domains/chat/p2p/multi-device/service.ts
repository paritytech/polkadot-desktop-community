/**
 * Multi-device chat envelope crypto and assembly.
 *
 * AES layer mirrors Android's `MessageEncryption.aes(aesKey)`
 * (common/.../MessageEncryption.kt): AES-256-GCM with a 12-byte random nonce
 * and 128-bit auth tag. Wire format is `nonce(12) || ciphertext || tag(16)` —
 * nonce prepended, tag appended by the AEAD. The key is used directly (no
 * HKDF) — that's the single distinction vs `createEncryption(sharedSecret)`
 * from @novasamatech/statement-store, which does HKDF-SHA256 on top because
 * its input is an ECDH X-coordinate.
 *
 * Envelope shape:
 *   encryptedRequest  = encrypt(oneShotKey, Request)
 *   encryptedResponse = encrypt(oneShotKey, Response)
 *   RequestDeviceInfo.encryptedKey = ECDH-wrap(oneShotKey, senderDevicePriv × recipientDevicePub)
 *
 * For each recipient device, the sender wraps the one-shot key as:
 *   shared = ECDH(senderDevicePrivate, recipientDevicePublic)
 *   aesKey = HKDF-SHA256(shared, salt=∅, info=∅, 32)
 *   wrapped = nonce(12) || AES-256-GCM(aesKey, nonce, oneShotKey) || tag(16)
 *
 * The sender's persistent device pubkey is NOT carried on the envelope —
 * receivers look it up from `Contact.devices[]` (populated via roster events).
 * Each recipient derives the same ECDH shared secret from `senderDevicePub +
 * their device private key`, unwraps its `encryptedKey` to recover the
 * one-shot key, and decrypts the payload. Both sides use their persistent
 * SSO V2 device keypair (no ephemeral).
 *
 * Symmetric flow:
 *   encryptForRecipients(plaintext, recipients, senderDevicePrivKey) → { data, oneShotKey }
 *   decryptForOwnDevice(data, ownStatementAccountId, ownDevicePrivKey, senderDevicePubKey) → plaintext
 *
 * Crypto helpers throw on auth-tag mismatch / malformed input. Callers wanting
 * Result-based error handling can wrap with `Result.fromThrowable` at the
 * boundary. The high-level decrypt pair returns null on any failure instead.
 */

import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { createEncryption } from '@novasamatech/statement-store';
import { mergeUint8 } from '@polkadot-api/utils';
import { type CodecType } from 'scale-ts';

import { type MultiDeviceRequest, type MultiDeviceResponse, StructuredStatementData } from '../requests/schemas';
import { p2pService } from '../service';

import { GCM_NONCE_BYTES, ONE_SHOT_KEY_BYTES } from './constants';
import { type DeviceTarget, type EncryptForRecipientsResult, type KeyWrap, type SymmetricEncrypt } from './types';

// ── AES-256-GCM inner layer ─────────────────────────────────────────────

function generateOneShotKey(): Uint8Array {
  return randomBytes(ONE_SHOT_KEY_BYTES);
}

function aesGcmEncrypt(key: Uint8Array, plaintext: Uint8Array): Uint8Array {
  const nonce = randomBytes(GCM_NONCE_BYTES);
  const aes = gcm(key, nonce);
  return mergeUint8([nonce, aes.encrypt(plaintext)]);
}

function aesGcmDecrypt(key: Uint8Array, encrypted: Uint8Array): Uint8Array {
  const nonce = encrypted.slice(0, GCM_NONCE_BYTES);
  const cipherText = encrypted.slice(GCM_NONCE_BYTES);
  const aes = gcm(key, nonce);
  return aes.decrypt(cipherText);
}

// ── Per-device ECDH wrap / unwrap (persistent device keypair) ──────────
// HKDF + AES-GCM delegated to `createEncryption` from @novasamatech/statement-store.

function wrapOneShotKey(
  senderDevicePrivateKey: Uint8Array,
  recipientDevicePublicKey: Uint8Array,
  oneShotKey: Uint8Array,
): Uint8Array {
  const shared = p2pService.computeSharedSecret(senderDevicePrivateKey, recipientDevicePublicKey);
  const encryption = createEncryption(shared);
  const result = encryption.encrypt(oneShotKey);
  if (result.isErr()) throw result.error;
  return result.value;
}

function unwrapOneShotKey(ownDevicePrivateKey: Uint8Array, senderDevicePublicKey: Uint8Array, wrapped: Uint8Array): Uint8Array {
  const shared = p2pService.computeSharedSecret(ownDevicePrivateKey, senderDevicePublicKey);
  const encryption = createEncryption(shared);
  const result = encryption.decrypt(wrapped);
  if (result.isErr()) throw result.error;
  return result.value;
}

// ── Envelope assembly ───────────────────────────────────────────────────
// The symmetric encryption (`encryptSymmetric`) and per-device key wrap
// (`wrapKey`) are accepted as parameters so the assembly logic stays
// decoupled from cipher choices — concrete defaults are the AES/ECDH
// helpers above.

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

function buildMultiDeviceRequest(params: {
  request: Uint8Array;
  recipients: DeviceTarget[];
  oneShotKey: Uint8Array;
  senderDevicePrivateKey: Uint8Array;
  encryptSymmetric: SymmetricEncrypt;
  wrapKey: KeyWrap;
}): CodecType<typeof MultiDeviceRequest> {
  return {
    encryptedRequest: params.encryptSymmetric(params.oneShotKey, params.request),
    devicesInfo: wrapPerDevice(params.recipients, params.senderDevicePrivateKey, params.oneShotKey, params.wrapKey),
  };
}

function buildMultiDeviceResponse(params: {
  response: Uint8Array;
  recipients: DeviceTarget[];
  oneShotKey: Uint8Array;
  senderDevicePrivateKey: Uint8Array;
  encryptSymmetric: SymmetricEncrypt;
  wrapKey: KeyWrap;
}): CodecType<typeof MultiDeviceResponse> {
  return {
    encryptedResponse: params.encryptSymmetric(params.oneShotKey, params.response),
    devicesInfo: wrapPerDevice(params.recipients, params.senderDevicePrivateKey, params.oneShotKey, params.wrapKey),
  };
}

// ── High-level round-trip pair ──────────────────────────────────────────

/**
 * Encrypt `plaintext` for delivery to N recipient devices.
 *
 * Uses the sender's persistent device keypair (from SSO V2 handshake) for
 * per-recipient ECDH wrap. Returns wire bytes wrapped in
 * `StructuredStatementData::MultiRequest` (discriminant 2) ready to put on
 * the statement's `data` field, plus the one-shot symmetric key (exposed for
 * tests and for callers that need it).
 */
function encryptForRecipients(
  plaintext: Uint8Array,
  recipients: DeviceTarget[],
  senderDevicePrivateKey: Uint8Array,
): EncryptForRecipientsResult {
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
}

/**
 * Mirror of `encryptForRecipients` for the response side. Wire bytes are
 * wrapped in `StructuredStatementData::MultiResponse` (discriminant 3).
 */
function encryptResponseForRecipients(
  plaintext: Uint8Array,
  recipients: DeviceTarget[],
  senderDevicePrivateKey: Uint8Array,
): EncryptForRecipientsResult {
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
}

/**
 * Decrypt a multi-device envelope for the recipient device whose
 * statementAccountId is `ownStatementAccountId`. `select` narrows the decoded
 * `StructuredStatementData` to the expected variant and pulls out its
 * per-device entries + ciphertext; a non-matching variant returns `null`.
 *
 * Returns null if:
 *   - the payload doesn't decode / isn't the expected variant
 *   - this device's account isn't in `devicesInfo`
 *   - the per-device key unwrap fails (auth tag mismatch — sender mismatch)
 *   - the inner symmetric decrypt fails
 *
 * The sender's device pubkey must come from `Contact.devices[]` — it is not on
 * the wire.
 */
function decryptOwnEnvelope(
  data: Uint8Array,
  ownStatementAccountId: Uint8Array,
  ownEncryptionPrivateKey: Uint8Array,
  senderEncryptionPublicKey: Uint8Array,
  select: (
    outer: ReturnType<typeof StructuredStatementData.dec>,
  ) => { devicesInfo: { statementAccountId: Uint8Array; encryptedKey: Uint8Array }[]; ciphertext: Uint8Array } | null,
): Uint8Array | null {
  let outer: ReturnType<typeof StructuredStatementData.dec>;
  try {
    outer = StructuredStatementData.dec(data);
  } catch {
    return null;
  }

  const envelope = select(outer);
  if (!envelope) return null;

  const ownEntry = envelope.devicesInfo.find(d => p2pService.bytesEqual(d.statementAccountId, ownStatementAccountId));
  if (!ownEntry) return null;

  let oneShotKey: Uint8Array;
  try {
    oneShotKey = unwrapOneShotKey(ownEncryptionPrivateKey, senderEncryptionPublicKey, ownEntry.encryptedKey);
  } catch {
    return null;
  }

  try {
    return aesGcmDecrypt(oneShotKey, envelope.ciphertext);
  } catch {
    return null;
  }
}

function decryptForOwnDevice(
  data: Uint8Array,
  ownStatementAccountId: Uint8Array,
  ownEncryptionPrivateKey: Uint8Array,
  senderEncryptionPublicKey: Uint8Array,
): Uint8Array | null {
  return decryptOwnEnvelope(data, ownStatementAccountId, ownEncryptionPrivateKey, senderEncryptionPublicKey, outer =>
    outer.tag === 'MultiRequest' ? { devicesInfo: outer.value.devicesInfo, ciphertext: outer.value.encryptedRequest } : null,
  );
}

function decryptResponseForOwnDevice(
  data: Uint8Array,
  ownStatementAccountId: Uint8Array,
  ownEncryptionPrivateKey: Uint8Array,
  senderEncryptionPublicKey: Uint8Array,
): Uint8Array | null {
  return decryptOwnEnvelope(data, ownStatementAccountId, ownEncryptionPrivateKey, senderEncryptionPublicKey, outer =>
    outer.tag === 'MultiResponse' ? { devicesInfo: outer.value.devicesInfo, ciphertext: outer.value.encryptedResponse } : null,
  );
}

export const multiDeviceService = {
  generateOneShotKey,
  aesGcmEncrypt,
  aesGcmDecrypt,
  wrapOneShotKey,
  unwrapOneShotKey,
  buildMultiDeviceRequest,
  buildMultiDeviceResponse,
  encryptForRecipients,
  encryptResponseForRecipients,
  decryptForOwnDevice,
  decryptResponseForOwnDevice,
};
