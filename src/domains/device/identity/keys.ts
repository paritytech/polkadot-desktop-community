import { p256 } from '@noble/curves/nist.js';
import { createSr25519Secret, deriveSr25519PublicKey } from '@novasamatech/statement-store';

const STATEMENT_ENTROPY_BYTES = 32;

export const generateStatementAccountSeed = (): Uint8Array => {
  const entropy = crypto.getRandomValues(new Uint8Array(STATEMENT_ENTROPY_BYTES));
  return createSr25519Secret(entropy);
};

export const deriveStatementAccountPublicKey = (seed: Uint8Array): Uint8Array => deriveSr25519PublicKey(seed);

export const generateEncryptionPrivateKey = (): Uint8Array => p256.keygen().secretKey;

// 65-byte uncompressed form: 0x04 || X || Y. Matches `Contact.devices[].encryptionPublicKey`
// and the ECDH inputs accepted by `computeSharedSecret` in chat/p2p/keys.ts.
export const deriveEncryptionPublicKey = (privateKey: Uint8Array): Uint8Array => p256.getPublicKey(privateKey, false);

/**
 * True when `bytes` is a usable device encryption public key: the 65-byte
 * uncompressed SEC1 form (`0x04 || X || Y`) of a point on P-256 — the shape
 * `deriveEncryptionPublicKey` produces and every ECDH callsite expects.
 *
 * Gate every externally-sourced device key through this before persisting or
 * deriving from it: host-papp 0.8.x's `remoteAccount.publicKey` is a 32-byte
 * SSO shared secret (not a key), and peer-supplied `deviceAdded` payloads are
 * unvalidated wire data. Feeding either into ECDH throws deep inside
 * `@noble/curves` ("second arg must be public key") — or worse, a malformed
 * key fans out to peers whose own sends then fail wholesale.
 */
export const isValidEncryptionPublicKey = (bytes: Uint8Array): boolean => {
  if (bytes.length !== 65 || bytes[0] !== 0x04) return false;
  try {
    p256.Point.fromBytes(bytes);
    return true;
  } catch {
    return false;
  }
};
