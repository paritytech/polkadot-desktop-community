import { describe, expect, it, vi } from 'vitest';

import { MultiDeviceRequest, MultiDeviceResponse } from '../requests/schemas';

import { multiDeviceService } from './service';
import { type DeviceTarget, type KeyWrap, type SymmetricEncrypt } from './types';

const recipient = (idFill: number, keyFill: number): DeviceTarget => ({
  statementAccountId: new Uint8Array(32).fill(idFill),
  encryptionPublicKey: new Uint8Array(65).fill(keyFill),
});

// Toy ciphers — distinguishable byte patterns let tests see what was passed to whom.
const tagSymmetric: SymmetricEncrypt = (key, plaintext) =>
  Uint8Array.from([0xaa, key[0] ?? 0, plaintext.length & 0xff, ...plaintext]);
const tagWrap: KeyWrap = (senderPriv, recipientPub, oneShotKey) =>
  Uint8Array.from([0xbb, senderPriv[0] ?? 0, recipientPub[0] ?? 0, oneShotKey[0] ?? 0]);

const senderPriv = (fill = 0xee) => new Uint8Array(32).fill(fill);

describe('buildMultiDeviceRequest', () => {
  it('encrypts the request once with the one-shot key', () => {
    const encryptSymmetric = vi.fn(tagSymmetric);
    const oneShotKey = new Uint8Array(32).fill(0x11);
    const request = new Uint8Array([1, 2, 3]);

    multiDeviceService.buildMultiDeviceRequest({
      request,
      recipients: [recipient(0xa1, 0x04), recipient(0xa2, 0x05)],
      oneShotKey,
      senderDevicePrivateKey: senderPriv(),
      encryptSymmetric,
      wrapKey: tagWrap,
    });

    expect(encryptSymmetric).toHaveBeenCalledOnce();
    expect(encryptSymmetric).toHaveBeenCalledWith(oneShotKey, request);
  });

  it('wraps the one-shot key once per recipient device with the sender persistent private key', () => {
    const wrapKey = vi.fn(tagWrap);
    const oneShotKey = new Uint8Array(32).fill(0x11);
    const recipients = [recipient(0xa1, 0x04), recipient(0xa2, 0x05), recipient(0xa3, 0x06)];
    const senderDevicePrivateKey = senderPriv();

    multiDeviceService.buildMultiDeviceRequest({
      request: new Uint8Array(),
      recipients,
      oneShotKey,
      senderDevicePrivateKey,
      encryptSymmetric: tagSymmetric,
      wrapKey,
    });

    expect(wrapKey).toHaveBeenCalledTimes(3);
    expect(wrapKey).toHaveBeenNthCalledWith(1, senderDevicePrivateKey, recipients[0]!.encryptionPublicKey, oneShotKey);
    expect(wrapKey).toHaveBeenNthCalledWith(2, senderDevicePrivateKey, recipients[1]!.encryptionPublicKey, oneShotKey);
    expect(wrapKey).toHaveBeenNthCalledWith(3, senderDevicePrivateKey, recipients[2]!.encryptionPublicKey, oneShotKey);
  });

  it('preserves the recipient statementAccountId on each devicesInfo entry', () => {
    const recipients = [recipient(0xa1, 0x04), recipient(0xa2, 0x05)];

    const built = multiDeviceService.buildMultiDeviceRequest({
      request: new Uint8Array([7]),
      recipients,
      oneShotKey: new Uint8Array(32).fill(0x11),
      senderDevicePrivateKey: senderPriv(),
      encryptSymmetric: tagSymmetric,
      wrapKey: tagWrap,
    });

    expect(built.devicesInfo).toHaveLength(2);
    expect(built.devicesInfo[0]!.statementAccountId).toEqual(recipients[0]!.statementAccountId);
    expect(built.devicesInfo[1]!.statementAccountId).toEqual(recipients[1]!.statementAccountId);
  });

  it('returns an empty devicesInfo when there are no recipients', () => {
    const built = multiDeviceService.buildMultiDeviceRequest({
      request: new Uint8Array([7]),
      recipients: [],
      oneShotKey: new Uint8Array(32).fill(0x11),
      senderDevicePrivateKey: senderPriv(),
      encryptSymmetric: tagSymmetric,
      wrapKey: vi.fn(),
    });

    expect(built.devicesInfo).toEqual([]);
  });

  it('produces a value that round-trips through the SCALE codec', () => {
    const built = multiDeviceService.buildMultiDeviceRequest({
      request: new Uint8Array([1, 2, 3]),
      recipients: [recipient(0xa1, 0x04), recipient(0xa2, 0x05)],
      oneShotKey: new Uint8Array(32).fill(0x11),
      senderDevicePrivateKey: senderPriv(),
      encryptSymmetric: tagSymmetric,
      wrapKey: tagWrap,
    });

    expect(MultiDeviceRequest.dec(MultiDeviceRequest.enc(built))).toEqual(built);
  });
});

describe('buildMultiDeviceResponse', () => {
  it('mirrors the request builder under the response field name', () => {
    const built = multiDeviceService.buildMultiDeviceResponse({
      response: new Uint8Array([9, 9]),
      recipients: [recipient(0xb1, 0x07)],
      oneShotKey: new Uint8Array(32).fill(0x22),
      senderDevicePrivateKey: senderPriv(),
      encryptSymmetric: tagSymmetric,
      wrapKey: tagWrap,
    });

    expect(built.encryptedResponse[0]).toBe(0xaa);
    expect(built.devicesInfo).toHaveLength(1);
    expect(MultiDeviceResponse.dec(MultiDeviceResponse.enc(built))).toEqual(built);
  });
});
