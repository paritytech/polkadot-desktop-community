import { x25519 } from '@noble/curves/ed25519.js';
import { deriveSr25519PublicKey } from '@novasamatech/statement-store';

/** X25519 public key size (CHAT-RFC-0004). */
const ENCRYPTION_PUBLIC_KEY_BYTES = 32;

const deriveStatementAccountPublicKey = (seed: Uint8Array): Uint8Array => deriveSr25519PublicKey(seed);

// 32-byte X25519 key — matches `Contact.devices[].encryptionPublicKey` and `p2pService.computeSharedSecret`.
const deriveEncryptionPublicKey = (privateKey: Uint8Array): Uint8Array => x25519.getPublicKey(privateKey);

/**
 * Gate every externally-sourced device key through this before persisting or deriving
 * from it — peer `deviceAdded` payloads are unvalidated wire data, and persisted rows
 * can hold whatever an older build wrote.
 *
 * Size is all it can check: every 32-byte string is a valid X25519 public key.
 * Degenerate keys are caught at agreement time (@noble aborts on an all-zero shared
 * secret, RFC 7748).
 */
const isValidEncryptionPublicKey = (bytes: Uint8Array): boolean => bytes.length === ENCRYPTION_PUBLIC_KEY_BYTES;

export const deviceIdentityService = {
  deriveStatementAccountPublicKey,
  deriveEncryptionPublicKey,
  isValidEncryptionPublicKey,
};
