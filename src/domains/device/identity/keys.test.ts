import { p256 } from '@noble/curves/nist.js';
import { deriveSr25519PublicKey } from '@novasamatech/statement-store';
import { describe, expect, it } from 'vitest';

import {
  deriveEncryptionPublicKey,
  deriveStatementAccountPublicKey,
  generateEncryptionPrivateKey,
  generateStatementAccountSeed,
  isValidEncryptionPublicKey,
} from './keys';

describe('generateStatementAccountSeed', () => {
  it('returns a 64-byte expanded sr25519 secret', () => {
    const seed = generateStatementAccountSeed();

    expect(seed).toBeInstanceOf(Uint8Array);
    expect(seed.length).toBe(64);
  });

  it('returns a different seed on each call', () => {
    const a = generateStatementAccountSeed();
    const b = generateStatementAccountSeed();

    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('produces a seed that derives a 32-byte sr25519 public key', () => {
    const seed = generateStatementAccountSeed();
    const publicKey = deriveSr25519PublicKey(seed);

    expect(publicKey.length).toBe(32);
  });
});

describe('deriveStatementAccountPublicKey', () => {
  it('is deterministic for a given seed', () => {
    const seed = generateStatementAccountSeed();
    const a = deriveStatementAccountPublicKey(seed);
    const b = deriveStatementAccountPublicKey(seed);

    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
});

describe('generateEncryptionPrivateKey', () => {
  it('returns a 32-byte P-256 private key', () => {
    const priv = generateEncryptionPrivateKey();

    expect(priv).toBeInstanceOf(Uint8Array);
    expect(priv.length).toBe(32);
  });

  it('returns a different key on each call', () => {
    const a = generateEncryptionPrivateKey();
    const b = generateEncryptionPrivateKey();

    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });
});

describe('deriveEncryptionPublicKey', () => {
  it('returns a 65-byte uncompressed P-256 public key', () => {
    const priv = generateEncryptionPrivateKey();
    const pub = deriveEncryptionPublicKey(priv);

    expect(pub.length).toBe(65);
    expect(pub[0]).toBe(0x04);
  });

  it('is deterministic for a given private key', () => {
    const priv = generateEncryptionPrivateKey();
    const a = deriveEncryptionPublicKey(priv);
    const b = deriveEncryptionPublicKey(priv);

    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('matches the noble/curves uncompressed encoding', () => {
    const priv = generateEncryptionPrivateKey();
    const ours = deriveEncryptionPublicKey(priv);
    const reference = p256.getPublicKey(priv, false);

    expect(Buffer.from(ours).equals(Buffer.from(reference))).toBe(true);
  });
});

describe('isValidEncryptionPublicKey', () => {
  it('accepts a derived 65-byte uncompressed key', () => {
    const pub = deriveEncryptionPublicKey(generateEncryptionPrivateKey());

    expect(isValidEncryptionPublicKey(pub)).toBe(true);
  });

  it('rejects a 32-byte value (e.g. an SSO shared secret persisted as a key)', () => {
    expect(isValidEncryptionPublicKey(new Uint8Array(32).fill(7))).toBe(false);
  });

  it('rejects a compressed 33-byte key', () => {
    const compressed = p256.getPublicKey(generateEncryptionPrivateKey(), true);

    expect(isValidEncryptionPublicKey(compressed)).toBe(false);
  });

  it('rejects 65 bytes that are not a point on the curve', () => {
    const junk = new Uint8Array(65).fill(0xff);
    junk[0] = 0x04;

    expect(isValidEncryptionPublicKey(junk)).toBe(false);
  });

  it('rejects 65 bytes without the uncompressed SEC1 prefix', () => {
    const pub = deriveEncryptionPublicKey(generateEncryptionPrivateKey());
    const mangled = pub.slice();
    mangled[0] = 0x05;

    expect(isValidEncryptionPublicKey(mangled)).toBe(false);
  });

  it('rejects empty input', () => {
    expect(isValidEncryptionPublicKey(new Uint8Array(0))).toBe(false);
  });
});
