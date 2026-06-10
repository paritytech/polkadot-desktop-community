import { describe, expect, it } from 'vitest';

import { DeviceAdded, DeviceRemoved, DeviceRosterEvent } from './device-event-codec';

const accountId = (fill: number) => new Uint8Array(32).fill(fill);
const publicKey = (fill: number) => new Uint8Array(65).fill(fill);

describe('DeviceAdded', () => {
  it('round-trips a 32-byte accountId and 65-byte uncompressed public key', () => {
    const e = { statementAccountId: accountId(0xa1), encryptionPublicKey: publicKey(0x04) };
    expect(DeviceAdded.dec(DeviceAdded.enc(e))).toEqual(e);
  });

  it('encodes with the expected fixed length (32 + 65 = 97 bytes)', () => {
    const e = { statementAccountId: accountId(0xa1), encryptionPublicKey: publicKey(0x04) };
    expect(DeviceAdded.enc(e).length).toBe(97);
  });
});

describe('DeviceRemoved', () => {
  it('round-trips a 32-byte accountId', () => {
    const e = { statementAccountId: accountId(0xb2) };
    expect(DeviceRemoved.dec(DeviceRemoved.enc(e))).toEqual(e);
  });

  it('encodes with the expected fixed length (32 bytes)', () => {
    const e = { statementAccountId: accountId(0xb2) };
    expect(DeviceRemoved.enc(e).length).toBe(32);
  });
});

describe('DeviceRosterEvent', () => {
  it('round-trips DeviceAdded as a tagged variant', () => {
    const e = {
      tag: 'DeviceAdded' as const,
      value: { statementAccountId: accountId(0xa1), encryptionPublicKey: publicKey(0x04) },
    };
    expect(DeviceRosterEvent.dec(DeviceRosterEvent.enc(e))).toEqual(e);
  });

  it('round-trips DeviceRemoved as a tagged variant', () => {
    const e = {
      tag: 'DeviceRemoved' as const,
      value: { statementAccountId: accountId(0xb2) },
    };
    expect(DeviceRosterEvent.dec(DeviceRosterEvent.enc(e))).toEqual(e);
  });

  it('discriminates variants by leading SCALE byte', () => {
    const added = DeviceRosterEvent.enc({
      tag: 'DeviceAdded' as const,
      value: { statementAccountId: accountId(0xa1), encryptionPublicKey: publicKey(0x04) },
    });
    const removed = DeviceRosterEvent.enc({
      tag: 'DeviceRemoved' as const,
      value: { statementAccountId: accountId(0xb2) },
    });

    expect(added[0]).toBe(0x00);
    expect(removed[0]).toBe(0x01);
  });
});
