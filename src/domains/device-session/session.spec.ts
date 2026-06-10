import { p256 } from '@noble/curves/nist.js';
import { describe, expect, it } from 'vitest';

import { decryptDeviceSessionPayload, encryptDeviceSessionPayload } from './session';

describe('device-session payload encryption', () => {
  it('round-trips arbitrary bytes between two devices that share an ECDH secret', () => {
    const aPriv = p256.utils.randomSecretKey();
    const aPub = p256.getPublicKey(aPriv, false);
    const bPriv = p256.utils.randomSecretKey();
    const bPub = p256.getPublicKey(bPriv, false);

    const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
    const ciphertext = encryptDeviceSessionPayload(plaintext, aPriv, bPub);
    const decrypted = decryptDeviceSessionPayload(ciphertext, bPriv, aPub);
    expect(Array.from(decrypted)).toEqual([1, 2, 3, 4, 5]);
  });

  it('decryption fails with wrong peer pubkey', () => {
    const aPriv = p256.utils.randomSecretKey();
    const bPriv = p256.utils.randomSecretKey();
    const bPub = p256.getPublicKey(bPriv, false);
    const cPub = p256.getPublicKey(p256.utils.randomSecretKey(), false);

    const ciphertext = encryptDeviceSessionPayload(new Uint8Array([1]), aPriv, bPub);
    expect(() => decryptDeviceSessionPayload(ciphertext, bPriv, cPub)).toThrow();
  });
});
