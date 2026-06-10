import { p256 } from '@noble/curves/nist.js';
import { describe, expect, it } from 'vitest';

import { computeSharedSecret } from './keys';

const SECRET_A = new Uint8Array(32).fill(0x01);
const SECRET_B = new Uint8Array(32).fill(0x02);
const SECRET_C = new Uint8Array(32).fill(0x03);

const keypair = (secret: Uint8Array) => ({
  privateKey: secret,
  publicKey: p256.getPublicKey(secret, false),
});

describe('computeSharedSecret', () => {
  it('returns 32 bytes', () => {
    const alice = keypair(SECRET_A);
    const bob = keypair(SECRET_B);
    expect(computeSharedSecret(alice.privateKey, bob.publicKey)).toHaveLength(32);
  });

  it('is symmetric — ECDH property: alice→bob equals bob→alice', () => {
    const alice = keypair(SECRET_A);
    const bob = keypair(SECRET_B);
    const aliceShared = computeSharedSecret(alice.privateKey, bob.publicKey);
    const bobShared = computeSharedSecret(bob.privateKey, alice.publicKey);
    expect(aliceShared).toEqual(bobShared);
  });

  it('different peers yield different shared secrets', () => {
    const alice = keypair(SECRET_A);
    const bob = keypair(SECRET_B);
    const charlie = keypair(SECRET_C);
    expect(computeSharedSecret(alice.privateKey, bob.publicKey)).not.toEqual(
      computeSharedSecret(alice.privateKey, charlie.publicKey),
    );
  });

  it('is deterministic', () => {
    const alice = keypair(SECRET_A);
    const bob = keypair(SECRET_B);
    const first = computeSharedSecret(alice.privateKey, bob.publicKey);
    const second = computeSharedSecret(alice.privateKey, bob.publicKey);
    expect(first).toEqual(second);
  });
});
