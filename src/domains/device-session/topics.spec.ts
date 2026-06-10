import { blake2b } from '@noble/hashes/blake2.js';
import { toHex } from 'polkadot-api/utils';
import { describe, expect, it } from 'vitest';

import { deriveDeviceSessionTopic } from './topics';

describe('deriveDeviceSessionTopic', () => {
  it('is directional — outgoing (a→b) differs from incoming (b→a)', () => {
    const sharedSecret = new Uint8Array(32).fill(0x10);
    const a = new Uint8Array(32).fill(0x01);
    const b = new Uint8Array(32).fill(0x02);
    const ab = deriveDeviceSessionTopic(sharedSecret, { accountId: a }, { accountId: b });
    const ba = deriveDeviceSessionTopic(sharedSecret, { accountId: b }, { accountId: a });
    expect(toHex(ab)).not.toBe(toHex(ba));
    expect(ab.length).toBe(32);
  });

  it('is deterministic given the same inputs', () => {
    const sharedSecret = new Uint8Array(32).fill(0x10);
    const a = new Uint8Array(32).fill(0x01);
    const b = new Uint8Array(32).fill(0x02);
    const t1 = deriveDeviceSessionTopic(sharedSecret, { accountId: a }, { accountId: b });
    const t2 = deriveDeviceSessionTopic(sharedSecret, { accountId: a }, { accountId: b });
    expect(toHex(t1)).toBe(toHex(t2));
  });

  it('changes when sharedSecret differs', () => {
    const a = new Uint8Array(32).fill(0x01);
    const b = new Uint8Array(32).fill(0x02);
    const t1 = deriveDeviceSessionTopic(new Uint8Array(32).fill(0x10), { accountId: a }, { accountId: b });
    const t2 = deriveDeviceSessionTopic(new Uint8Array(32).fill(0x11), { accountId: a }, { accountId: b });
    expect(toHex(t1)).not.toBe(toHex(t2));
  });

  // Hand-rebuilt expected wire bytes — verifies the byte layout matches
  // Android exactly:
  //   key  = sharedSecret
  //   data = "session" || sender(32) || receiver(32) || "/" || "" || "/" || ""
  //
  // PApp must compute the same hex for the same (sharedSecret, sender,
  // receiver) tuple; any drift here breaks the wire.
  it('byte layout matches "session" || sender || receiver || "//"', () => {
    const sharedSecret = new Uint8Array(32).fill(0x10);
    const sender = new Uint8Array(32).fill(0x01);
    const receiver = new Uint8Array(32).fill(0x02);
    const enc = new TextEncoder();
    const data = new Uint8Array(7 + 32 + 32 + 1 + 1);
    let i = 0;
    data.set(enc.encode('session'), i);
    i += 7;
    data.set(sender, i);
    i += 32;
    data.set(receiver, i);
    i += 32;
    data.set(enc.encode('/'), i);
    i += 1;
    data.set(enc.encode('/'), i);
    const expected = blake2b(data, { dkLen: 32, key: sharedSecret });
    const actual = deriveDeviceSessionTopic(sharedSecret, { accountId: sender }, { accountId: receiver });
    expect(toHex(actual)).toBe(toHex(expected));
  });
});
