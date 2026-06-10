/**
 * P-256 ECDH shared-secret derivation used across the V2 chat stack
 * (chatRequestV2, chatSessionV2, acceptSignalV2, multi-device-crypto, and the
 * V2 manager's push-notification path).
 */

import { p256 } from '@noble/curves/nist.js';

/**
 * Compute ECDH shared secret between our P256 private key and peer's P256 public key.
 * Returns the X coordinate (32 bytes), matching host-papp's createSharedSecret.
 */
export const computeSharedSecret = (privateKey: Uint8Array, peerPublicKey: Uint8Array): Uint8Array => {
  return p256.getSharedSecret(privateKey, peerPublicKey).slice(1, 33);
};
