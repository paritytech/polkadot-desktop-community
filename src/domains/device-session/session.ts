/**
 * Device-to-device signaling payload encryption. AES-256-GCM keyed via
 * HKDF-SHA256 (empty salt + empty info — parity with Android `Hkdf.kt` +
 * `MessageEncryption.kt`) over ECDH(devEncPriv, peerDevEncPub).
 * Wire: nonce(12) || ciphertext || authTag(16). Non-empty info silently
 * desynchronises the AES key vs PApp.
 */

import { gcm } from '@noble/ciphers/aes.js';
import { p256 } from '@noble/curves/nist.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { mergeUint8 } from '@polkadot-api/utils';

const NONCE_BYTES = 12;
const KEY_BYTES = 32;
// Both salt and info are empty to match Android.
const HKDF_EMPTY = new Uint8Array(0);

function deriveKey(devPriv: Uint8Array, peerDevPub: Uint8Array): Uint8Array {
  // noble's `getSharedSecret` defaults to a compressed SEC1 point: 33 bytes =
  // [prefix(1)][X(32)]. `slice(1, 33)` extracts the 32-byte X coordinate and
  // also handles the 65-byte uncompressed form ([0x04][X(32)][Y(32)]) — same
  // 32 bytes either way. **Do NOT** length-branch into `slice(0, 32)`: that
  // returns [prefix][X[0..30]], which corrupts the ECDH secret and produces
  // a key that no peer can match. Every other ECDH callsite in this repo
  // uses this exact form (`src/domains/chat/p2p/keys.ts`,
  // `vendor/host-papp/dist/sso/auth/v2/envelope.js`) — keep it consistent.
  //
  // Android's BouncyCastle `KeyAgreement.generateSecret()` returns the raw
  // 32-byte X coordinate directly; we have to peel SEC1 ourselves.
  const sharedX = p256.getSharedSecret(devPriv, peerDevPub).slice(1, 33);
  return hkdf(sha256, sharedX, HKDF_EMPTY, HKDF_EMPTY, KEY_BYTES);
}

export function encryptDeviceSessionPayload(plaintext: Uint8Array, devPriv: Uint8Array, peerDevPub: Uint8Array): Uint8Array {
  const key = deriveKey(devPriv, peerDevPub);
  const nonce = randomBytes(NONCE_BYTES);
  const aes = gcm(key, nonce);
  return mergeUint8([nonce, aes.encrypt(plaintext)]);
}

export function decryptDeviceSessionPayload(ciphertext: Uint8Array, devPriv: Uint8Array, peerDevPub: Uint8Array): Uint8Array {
  const key = deriveKey(devPriv, peerDevPub);
  const nonce = ciphertext.slice(0, NONCE_BYTES);
  const cipherBody = ciphertext.slice(NONCE_BYTES);
  const aes = gcm(key, nonce);
  return aes.decrypt(cipherBody);
}
