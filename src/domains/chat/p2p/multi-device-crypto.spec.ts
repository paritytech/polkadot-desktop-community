import { p256 } from '@noble/curves/nist.js';
import { describe, expect, it } from 'vitest';

import {
  GCM_NONCE_BYTES,
  ONE_SHOT_KEY_BYTES,
  aesGcmDecrypt,
  aesGcmEncrypt,
  generateOneShotKey,
  unwrapOneShotKey,
  wrapOneShotKey,
} from './multi-device-crypto';

const generateP256KeyPair = (): { privateKey: Uint8Array; publicKey: Uint8Array } => {
  const privateKey = p256.utils.randomSecretKey();
  return { privateKey, publicKey: p256.getPublicKey(privateKey, false) };
};

describe('generateOneShotKey', () => {
  it('returns a 32-byte AES-256 key', () => {
    const key = generateOneShotKey();
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(ONE_SHOT_KEY_BYTES);
  });

  it('returns a different key on each call', () => {
    const a = generateOneShotKey();
    const b = generateOneShotKey();
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });
});

describe('aesGcmEncrypt / aesGcmDecrypt', () => {
  const key = () => new Uint8Array(ONE_SHOT_KEY_BYTES).fill(0x42);

  it('round-trips an arbitrary payload', () => {
    const plaintext = new TextEncoder().encode('hello multi-device');
    const encrypted = aesGcmEncrypt(key(), plaintext);
    const decrypted = aesGcmDecrypt(key(), encrypted);

    expect(new TextDecoder().decode(decrypted)).toBe('hello multi-device');
  });

  it('round-trips an empty payload', () => {
    const encrypted = aesGcmEncrypt(key(), new Uint8Array(0));
    const decrypted = aesGcmDecrypt(key(), encrypted);

    expect(decrypted.length).toBe(0);
  });

  it('produces a different ciphertext on each encrypt (random nonce)', () => {
    const plaintext = new Uint8Array([1, 2, 3, 4]);
    const a = aesGcmEncrypt(key(), plaintext);
    const b = aesGcmEncrypt(key(), plaintext);

    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('produces a wire format starting with the 12-byte nonce', () => {
    const plaintext = new Uint8Array([1, 2, 3]);
    const encrypted = aesGcmEncrypt(key(), plaintext);

    expect(encrypted.length).toBeGreaterThan(GCM_NONCE_BYTES);
    // GCM ciphertext = plaintext.length + 16-byte auth tag, prefixed by 12-byte nonce
    expect(encrypted.length).toBe(GCM_NONCE_BYTES + plaintext.length + 16);
  });

  it('fails to decrypt with a different key (auth tag mismatch)', () => {
    const encrypted = aesGcmEncrypt(key(), new Uint8Array([1, 2, 3]));
    const wrongKey = new Uint8Array(ONE_SHOT_KEY_BYTES).fill(0x77);

    expect(() => aesGcmDecrypt(wrongKey, encrypted)).toThrow();
  });

  it('fails to decrypt when the ciphertext is corrupted', () => {
    const encrypted = aesGcmEncrypt(key(), new Uint8Array([1, 2, 3]));
    const corrupted = new Uint8Array(encrypted);
    corrupted.set([(corrupted.at(-1) ?? 0) ^ 0xff], corrupted.length - 1);

    expect(() => aesGcmDecrypt(key(), corrupted)).toThrow();
  });

  it('fails to decrypt when the nonce is corrupted', () => {
    const encrypted = aesGcmEncrypt(key(), new Uint8Array([1, 2, 3]));
    const corrupted = new Uint8Array(encrypted);
    corrupted.set([(corrupted.at(0) ?? 0) ^ 0xff], 0);

    expect(() => aesGcmDecrypt(key(), corrupted)).toThrow();
  });

  it('decrypts ciphertext produced by createEncryption-style framing (12-byte nonce prefix)', () => {
    const k = key();
    const plaintext = new Uint8Array([9, 9, 9, 9]);
    const encrypted = aesGcmEncrypt(k, plaintext);

    // Manually reassemble using the documented wire format and decrypt.
    const nonce = encrypted.slice(0, GCM_NONCE_BYTES);
    const ctAndTag = encrypted.slice(GCM_NONCE_BYTES);
    const reassembled = new Uint8Array(nonce.length + ctAndTag.length);
    reassembled.set(nonce, 0);
    reassembled.set(ctAndTag, nonce.length);

    expect(aesGcmDecrypt(k, reassembled)).toEqual(plaintext);
  });
});

describe('wrapOneShotKey / unwrapOneShotKey', () => {
  it('round-trips a one-shot key between sender device and recipient device persistent keypairs', () => {
    const sender = generateP256KeyPair();
    const recipient = generateP256KeyPair();
    const oneShot = generateOneShotKey();

    const wrapped = wrapOneShotKey(sender.privateKey, recipient.publicKey, oneShot);
    const unwrapped = unwrapOneShotKey(recipient.privateKey, sender.publicKey, wrapped);

    expect(unwrapped).toEqual(oneShot);
  });

  it('produces a different wrapped value for the same key and recipient on each wrap (random nonce)', () => {
    const sender = generateP256KeyPair();
    const recipient = generateP256KeyPair();
    const oneShot = generateOneShotKey();

    const a = wrapOneShotKey(sender.privateKey, recipient.publicKey, oneShot);
    const b = wrapOneShotKey(sender.privateKey, recipient.publicKey, oneShot);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('fails to unwrap with the wrong recipient private key', () => {
    const sender = generateP256KeyPair();
    const recipient = generateP256KeyPair();
    const wrong = generateP256KeyPair();

    const wrapped = wrapOneShotKey(sender.privateKey, recipient.publicKey, generateOneShotKey());
    expect(() => unwrapOneShotKey(wrong.privateKey, sender.publicKey, wrapped)).toThrow();
  });

  it('fails to unwrap with a forged sender pubkey', () => {
    const sender = generateP256KeyPair();
    const recipient = generateP256KeyPair();
    const forged = generateP256KeyPair();

    const wrapped = wrapOneShotKey(sender.privateKey, recipient.publicKey, generateOneShotKey());
    expect(() => unwrapOneShotKey(recipient.privateKey, forged.publicKey, wrapped)).toThrow();
  });
});
