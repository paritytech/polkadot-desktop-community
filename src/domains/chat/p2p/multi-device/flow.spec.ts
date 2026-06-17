import { p256 } from '@noble/curves/nist.js';
import { describe, expect, it } from 'vitest';

import { multiDeviceService } from './service';
import { type DeviceTarget } from './types';

const generateP256KeyPair = () => {
  const privateKey = p256.utils.randomSecretKey();
  return { privateKey, publicKey: p256.getPublicKey(privateKey, false) };
};

const makeRecipient = (idFill: number): { target: DeviceTarget; privateKey: Uint8Array } => {
  const kp = generateP256KeyPair();
  return {
    target: {
      statementAccountId: new Uint8Array(32).fill(idFill),
      encryptionPublicKey: kp.publicKey,
    },
    privateKey: kp.privateKey,
  };
};

describe('multiDeviceService.encryptForRecipients / multiDeviceService.decryptForOwnDevice (request side)', () => {
  it('round-trips a payload to a single recipient device', () => {
    const sender = generateP256KeyPair();
    const recipient = makeRecipient(0xa1);
    const plaintext = new TextEncoder().encode('hello multi-device');

    const { data } = multiDeviceService.encryptForRecipients(plaintext, [recipient.target], sender.privateKey);
    const decrypted = multiDeviceService.decryptForOwnDevice(
      data,
      recipient.target.statementAccountId,
      recipient.privateKey,
      sender.publicKey,
    );

    expect(decrypted).not.toBeNull();
    expect(new TextDecoder().decode(decrypted!)).toBe('hello multi-device');
  });

  it('delivers the same plaintext to every recipient device', () => {
    const sender = generateP256KeyPair();
    const r1 = makeRecipient(0xa1);
    const r2 = makeRecipient(0xa2);
    const r3 = makeRecipient(0xa3);
    const plaintext = new Uint8Array([1, 2, 3, 4]);

    const { data } = multiDeviceService.encryptForRecipients(plaintext, [r1.target, r2.target, r3.target], sender.privateKey);

    expect(multiDeviceService.decryptForOwnDevice(data, r1.target.statementAccountId, r1.privateKey, sender.publicKey)).toEqual(
      plaintext,
    );
    expect(multiDeviceService.decryptForOwnDevice(data, r2.target.statementAccountId, r2.privateKey, sender.publicKey)).toEqual(
      plaintext,
    );
    expect(multiDeviceService.decryptForOwnDevice(data, r3.target.statementAccountId, r3.privateKey, sender.publicKey)).toEqual(
      plaintext,
    );
  });

  it('returns null when the receiver is not in the recipient list', () => {
    const sender = generateP256KeyPair();
    const recipient = makeRecipient(0xa1);
    const stranger = makeRecipient(0xff);
    const plaintext = new Uint8Array([1, 2, 3]);

    const { data } = multiDeviceService.encryptForRecipients(plaintext, [recipient.target], sender.privateKey);

    expect(
      multiDeviceService.decryptForOwnDevice(data, stranger.target.statementAccountId, stranger.privateKey, sender.publicKey),
    ).toBeNull();
  });

  it('returns null when the recipient uses the wrong encryption private key', () => {
    const sender = generateP256KeyPair();
    const recipient = makeRecipient(0xa1);
    const wrongPriv = generateP256KeyPair().privateKey;
    const plaintext = new Uint8Array([1, 2, 3]);

    const { data } = multiDeviceService.encryptForRecipients(plaintext, [recipient.target], sender.privateKey);

    expect(
      multiDeviceService.decryptForOwnDevice(data, recipient.target.statementAccountId, wrongPriv, sender.publicKey),
    ).toBeNull();
  });

  it('returns null on a corrupted ciphertext', () => {
    const sender = generateP256KeyPair();
    const recipient = makeRecipient(0xa1);
    const plaintext = new Uint8Array([1, 2, 3]);

    const { data } = multiDeviceService.encryptForRecipients(plaintext, [recipient.target], sender.privateKey);
    const tampered = new Uint8Array(data);
    tampered.set([(tampered.at(-1) ?? 0) ^ 0xff], tampered.length - 1);

    expect(
      multiDeviceService.decryptForOwnDevice(
        tampered,
        recipient.target.statementAccountId,
        recipient.privateKey,
        sender.publicKey,
      ),
    ).toBeNull();
  });

  it('returns null on a non-MultiDeviceRequest byte sequence (graceful decode failure)', () => {
    const sender = generateP256KeyPair();
    const recipient = makeRecipient(0xa1);

    // Not a valid MultiDeviceRequest — garbage bytes.
    const garbage = new Uint8Array([1, 2, 3]);

    expect(
      multiDeviceService.decryptForOwnDevice(
        garbage,
        recipient.target.statementAccountId,
        recipient.privateKey,
        sender.publicKey,
      ),
    ).toBeNull();
  });

  it('produces a different ciphertext on each encrypt (random nonce + one-shot key)', () => {
    const sender = generateP256KeyPair();
    const recipient = makeRecipient(0xa1);
    const plaintext = new Uint8Array([1, 2, 3]);

    const a = multiDeviceService.encryptForRecipients(plaintext, [recipient.target], sender.privateKey);
    const b = multiDeviceService.encryptForRecipients(plaintext, [recipient.target], sender.privateKey);

    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(false);
  });

  it('returns null when the sender pubkey does not match the actual encrypter', () => {
    const sender = generateP256KeyPair();
    const otherSender = generateP256KeyPair();
    const recipient = makeRecipient(0xa1);
    const plaintext = new Uint8Array([1, 2, 3]);

    const { data } = multiDeviceService.encryptForRecipients(plaintext, [recipient.target], sender.privateKey);

    expect(
      multiDeviceService.decryptForOwnDevice(
        data,
        recipient.target.statementAccountId,
        recipient.privateKey,
        otherSender.publicKey,
      ),
    ).toBeNull();
  });
});

describe('multiDeviceService.encryptResponseForRecipients / decryptResponseForOwnDevice', () => {
  it('round-trips a response payload', () => {
    const sender = generateP256KeyPair();
    const recipient = makeRecipient(0xb1);
    const plaintext = new TextEncoder().encode('response body');

    const { data } = multiDeviceService.encryptResponseForRecipients(plaintext, [recipient.target], sender.privateKey);
    const decrypted = multiDeviceService.decryptResponseForOwnDevice(
      data,
      recipient.target.statementAccountId,
      recipient.privateKey,
      sender.publicKey,
    );

    expect(decrypted).not.toBeNull();
    expect(new TextDecoder().decode(decrypted!)).toBe('response body');
  });
});
