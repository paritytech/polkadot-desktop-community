/**
 * AES-256-GCM helpers used by the multi-device chat envelope's inner layer.
 *
 * Mirrors Android's `MessageEncryption.aes(aesKey)` (common/.../MessageEncryption.kt):
 * AES-256-GCM with a 12-byte random nonce and 128-bit auth tag. Wire format
 * is `nonce(12) || ciphertext || tag(16)` — nonce prepended, tag appended by
 * the AEAD. The key is used directly (no HKDF) — that's the single distinction
 * vs `createEncryption(sharedSecret)` from @novasamatech/statement-store, which
 * does HKDF-SHA256 on top because its input is an ECDH X-coordinate.
 *
 * Used for the spec's `encrypt(REQ_PK, Request)` / `encrypt(RES_PK, Response)`
 * layer, where REQ_PK is a one-shot symmetric AES key fanned out per recipient
 * device via `MultiDeviceRequest.devicesInfo[].encryptedKey`.
 *
 * Throws on auth-tag mismatch / malformed input. Callers wanting Result-based
 * error handling can wrap with `Result.fromThrowable` at the boundary.
 */

import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { createEncryption } from '@novasamatech/statement-store';
import { mergeUint8 } from '@polkadot-api/utils';

import { computeSharedSecret } from './keys';

const NONCE_BYTES = 12;
const KEY_BYTES = 32;

export const ONE_SHOT_KEY_BYTES = KEY_BYTES;
export const GCM_NONCE_BYTES = NONCE_BYTES;

export const generateOneShotKey = (): Uint8Array => randomBytes(KEY_BYTES);

export const aesGcmEncrypt = (key: Uint8Array, plaintext: Uint8Array): Uint8Array => {
  const nonce = randomBytes(NONCE_BYTES);
  const aes = gcm(key, nonce);
  return mergeUint8([nonce, aes.encrypt(plaintext)]);
};

export const aesGcmDecrypt = (key: Uint8Array, encrypted: Uint8Array): Uint8Array => {
  const nonce = encrypted.slice(0, NONCE_BYTES);
  const cipherText = encrypted.slice(NONCE_BYTES);
  const aes = gcm(key, nonce);
  return aes.decrypt(cipherText);
};

// ── Per-device ECDH wrap / unwrap (persistent device keypair) ──────────
//
// For each recipient device, the sender wraps the one-shot key as:
//   shared = ECDH(senderDevicePrivate, recipientDevicePublic)
//   aesKey = HKDF-SHA256(shared, salt=∅, info=∅, 32)
//   wrapped = nonce(12) || AES-256-GCM(aesKey, nonce, oneShotKey) || tag(16)
//
// The sender's device pubkey is NOT carried on the envelope — receivers
// look it up from their local Contact.devices[] (populated via roster
// events). Both sides use their persistent SSO V2 device keypair.
//
// HKDF + AES-GCM delegated to `createEncryption` from @novasamatech/statement-store.

export const wrapOneShotKey = (
  senderDevicePrivateKey: Uint8Array,
  recipientDevicePublicKey: Uint8Array,
  oneShotKey: Uint8Array,
): Uint8Array => {
  const shared = computeSharedSecret(senderDevicePrivateKey, recipientDevicePublicKey);
  const encryption = createEncryption(shared);
  const result = encryption.encrypt(oneShotKey);
  if (result.isErr()) throw result.error;
  return result.value;
};

export const unwrapOneShotKey = (
  ownDevicePrivateKey: Uint8Array,
  senderDevicePublicKey: Uint8Array,
  wrapped: Uint8Array,
): Uint8Array => {
  const shared = computeSharedSecret(ownDevicePrivateKey, senderDevicePublicKey);
  const encryption = createEncryption(shared);
  const result = encryption.decrypt(wrapped);
  if (result.isErr()) throw result.error;
  return result.value;
};
