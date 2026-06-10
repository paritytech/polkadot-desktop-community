import { describe, expect, it } from 'vitest';

import {
  type MetadataEntry,
  Device,
  EncryptedHandshakeResponseV1,
  EncryptedHandshakeResponseV2,
  HandshakeProposalV2,
  HandshakeResponseV1,
  HandshakeResponseV2,
  HandshakeStatusV2,
  HandshakeSuccessV2,
  HandshakeSuccessV2Legacy,
  MetadataKey,
  VersionedHandshakeProposal,
  VersionedHandshakeResponse,
  decodeEncryptedHandshakeResponseV2,
} from './codec';

const makeDevice = () => ({
  statementAccountId: new Uint8Array(32).fill(0xa1),
  encryptionPublicKey: new Uint8Array(65).fill(0x04),
});

describe('MetadataKey', () => {
  it('round-trips Custom with arbitrary string', () => {
    const m = { tag: 'Custom' as const, value: 'app.theme' };
    expect(MetadataKey.dec(MetadataKey.enc(m))).toEqual(m);
  });

  it('round-trips each unit variant', () => {
    const variants = ['HostName', 'HostVersion', 'HostIcon', 'PlatformType', 'PlatformVersion'] as const;
    for (const tag of variants) {
      const m = { tag, value: undefined };
      expect(MetadataKey.dec(MetadataKey.enc(m))).toEqual(m);
    }
  });
});

describe('Device', () => {
  it('round-trips a 32-byte accountId and 65-byte uncompressed public key', () => {
    const d = makeDevice();
    expect(Device.dec(Device.enc(d))).toEqual(d);
  });

  it('encodes Device with the expected fixed length (32 + 65 = 97 bytes)', () => {
    expect(Device.enc(makeDevice()).length).toBe(97);
  });
});

describe('HandshakeProposalV2', () => {
  it('round-trips with empty metadata', () => {
    const p = { device: makeDevice(), metadata: [] };
    expect(HandshakeProposalV2.dec(HandshakeProposalV2.enc(p))).toEqual(p);
  });

  it('round-trips with mixed metadata variants', () => {
    const metadata: ReturnType<typeof MetadataEntry.dec>[] = [
      [{ tag: 'HostName' as const, value: undefined }, 'Polkadot Desktop'],
      [{ tag: 'HostVersion' as const, value: undefined }, '0.1.0'],
      [{ tag: 'PlatformType' as const, value: undefined }, 'macOS'],
      [{ tag: 'Custom' as const, value: 'app.theme' }, 'dark'],
    ];
    const p = { device: makeDevice(), metadata };
    expect(HandshakeProposalV2.dec(HandshakeProposalV2.enc(p))).toEqual(p);
  });
});

describe('VersionedHandshakeProposal', () => {
  it('round-trips a V2 proposal', () => {
    const versioned = {
      tag: 'V2' as const,
      value: { device: makeDevice(), metadata: [] },
    };
    expect(VersionedHandshakeProposal.dec(VersionedHandshakeProposal.enc(versioned))).toEqual(versioned);
  });
});

describe('HandshakeSuccessV2', () => {
  it('round-trips identityAccountId, rootAccountId, identityChatPrivateKey, deviceEncPubKey', () => {
    const s = {
      identityAccountId: new Uint8Array(32).fill(0xb2),
      rootAccountId: new Uint8Array(32).fill(0xc3),
      identityChatPrivateKey: new Uint8Array(32).fill(0x05),
      deviceEncPubKey: new Uint8Array(65).fill(0x04),
    };
    expect(HandshakeSuccessV2.dec(HandshakeSuccessV2.enc(s))).toEqual(s);
  });

  it('encodes Success with the expected fixed length (32 + 32 + 32 + 65 = 161 bytes)', () => {
    const s = {
      identityAccountId: new Uint8Array(32).fill(0xb2),
      rootAccountId: new Uint8Array(32).fill(0xc3),
      identityChatPrivateKey: new Uint8Array(32).fill(0x05),
      deviceEncPubKey: new Uint8Array(65).fill(0x04),
    };
    expect(HandshakeSuccessV2.enc(s).length).toBe(161);
  });

  it('preserves field order on the wire (identity, root, chatPriv, deviceEnc)', () => {
    const s = {
      identityAccountId: new Uint8Array(32).fill(0xb2),
      rootAccountId: new Uint8Array(32).fill(0xc3),
      identityChatPrivateKey: new Uint8Array(32).fill(0x05),
      deviceEncPubKey: new Uint8Array(65).fill(0x04),
    };
    const wire = HandshakeSuccessV2.enc(s);
    expect(wire.slice(0, 32).every(b => b === 0xb2)).toBe(true);
    expect(wire.slice(32, 64).every(b => b === 0xc3)).toBe(true);
    expect(wire.slice(64, 96).every(b => b === 0x05)).toBe(true);
    expect(wire.slice(96, 161).every(b => b === 0x04)).toBe(true);
  });
});

describe('EncryptedHandshakeResponseV2', () => {
  it('round-trips Pending(AllowanceAllocation)', () => {
    const r = {
      tag: 'Pending' as const,
      value: { tag: 'AllowanceAllocation' as const, value: undefined },
    };
    expect(EncryptedHandshakeResponseV2.dec(EncryptedHandshakeResponseV2.enc(r))).toEqual(r);
  });

  it('round-trips Success', () => {
    const r = {
      tag: 'Success' as const,
      value: {
        identityAccountId: new Uint8Array(32).fill(0xb2),
        rootAccountId: new Uint8Array(32).fill(0xc3),
        identityChatPrivateKey: new Uint8Array(32).fill(0x05),
        deviceEncPubKey: new Uint8Array(65).fill(0x04),
      },
    };
    expect(EncryptedHandshakeResponseV2.dec(EncryptedHandshakeResponseV2.enc(r))).toEqual(r);
  });

  it('round-trips Failed with a reason string', () => {
    const r = { tag: 'Failed' as const, value: 'user declined on mobile' };
    expect(EncryptedHandshakeResponseV2.dec(EncryptedHandshakeResponseV2.enc(r))).toEqual(r);
  });
});

describe('HandshakeStatusV2', () => {
  it('round-trips AllowanceAllocation', () => {
    const s = { tag: 'AllowanceAllocation' as const, value: undefined };
    expect(HandshakeStatusV2.dec(HandshakeStatusV2.enc(s))).toEqual(s);
  });
});

describe('HandshakeResponseV2', () => {
  it('round-trips with arbitrary ciphertext and ephemeral key', () => {
    const r = {
      encrypted: new Uint8Array([1, 2, 3, 4, 5]),
      tmpKey: new Uint8Array(65).fill(0x04),
    };
    expect(HandshakeResponseV2.dec(HandshakeResponseV2.enc(r))).toEqual(r);
  });
});

describe('VersionedHandshakeResponse', () => {
  it('round-trips a V2 response', () => {
    const r = {
      tag: 'V2' as const,
      value: { encrypted: new Uint8Array([7, 8, 9]), tmpKey: new Uint8Array(65).fill(0x04) },
    };
    expect(VersionedHandshakeResponse.dec(VersionedHandshakeResponse.enc(r))).toEqual(r);
  });

  it('decodes a legacy V1 response from older mobile clients', () => {
    const r = {
      tag: 'V1' as const,
      value: { encrypted: new Uint8Array([1, 2]), tmpKey: new Uint8Array(65).fill(0x04) },
    };
    expect(VersionedHandshakeResponse.dec(VersionedHandshakeResponse.enc(r))).toEqual(r);
  });
});

describe('EncryptedHandshakeResponseV1 (legacy)', () => {
  it('round-trips encryptionKey and accountId', () => {
    const r = {
      encryptionKey: new Uint8Array(65).fill(0x04),
      accountId: new Uint8Array(32).fill(0xb2),
    };
    expect(EncryptedHandshakeResponseV1.dec(EncryptedHandshakeResponseV1.enc(r))).toEqual(r);
  });
});

describe('HandshakeResponseV1 (legacy)', () => {
  it('round-trips with arbitrary ciphertext and ephemeral key', () => {
    const r = {
      encrypted: new Uint8Array([0xff, 0xee]),
      tmpKey: new Uint8Array(65).fill(0x04),
    };
    expect(HandshakeResponseV1.dec(HandshakeResponseV1.enc(r))).toEqual(r);
  });
});

describe('HandshakeSuccessV2Legacy', () => {
  it('round-trips identityAccountId, identityChatPrivateKey, deviceEncPubKey (no rootAccountId)', () => {
    const s = {
      identityAccountId: new Uint8Array(32).fill(0xb2),
      identityChatPrivateKey: new Uint8Array(32).fill(0x05),
      deviceEncPubKey: new Uint8Array(65).fill(0x04),
    };
    expect(HandshakeSuccessV2Legacy.dec(HandshakeSuccessV2Legacy.enc(s))).toEqual(s);
  });

  it('encodes to exactly 129 bytes (32 + 32 + 65 — no rootAccountId)', () => {
    const s = {
      identityAccountId: new Uint8Array(32),
      identityChatPrivateKey: new Uint8Array(32),
      deviceEncPubKey: new Uint8Array(65),
    };
    expect(HandshakeSuccessV2Legacy.enc(s).length).toBe(129);
  });
});

describe('decodeEncryptedHandshakeResponseV2 (length-dispatched)', () => {
  it('decodes the v0.2.1 161-byte Success payload (with rootAccountId)', () => {
    const s = {
      identityAccountId: new Uint8Array(32).fill(0xb2),
      rootAccountId: new Uint8Array(32).fill(0xc3),
      identityChatPrivateKey: new Uint8Array(32).fill(0x05),
      deviceEncPubKey: new Uint8Array(65).fill(0x04),
    };
    const innerBytes = EncryptedHandshakeResponseV2.enc({ tag: 'Success', value: s });
    const result = decodeEncryptedHandshakeResponseV2(innerBytes);
    expect(result.tag).toBe('Success');
    if (result.tag === 'Success') {
      expect(result.value.identityAccountId).toEqual(s.identityAccountId);
      expect(result.value.rootAccountId).toEqual(s.rootAccountId);
      expect(result.value.identityChatPrivateKey).toEqual(s.identityChatPrivateKey);
      expect(result.value.deviceEncPubKey).toEqual(s.deviceEncPubKey);
    }
  });

  it('decodes the v0.2 legacy Success payload (Android feature/location-for-handshake, 129B body), surfaces null rootAccountId', () => {
    // Wire shape matches android `HandshakeSuccessV2Scale` on
    // `feature/location-for-handshake`: 3 fields, no rootAccountId.
    const identityAccountId = new Uint8Array(32).fill(0xb2);
    const identityChatPrivateKey = new Uint8Array(32).fill(0x05);
    const deviceEncPubKey = new Uint8Array(65).fill(0x04);
    const innerBytes = new Uint8Array(1 + 32 + 32 + 65);
    innerBytes[0] = 0x01; // Success enum tag
    innerBytes.set(identityAccountId, 1);
    innerBytes.set(identityChatPrivateKey, 1 + 32);
    innerBytes.set(deviceEncPubKey, 1 + 32 + 32);
    expect(innerBytes.length).toBe(130);

    const result = decodeEncryptedHandshakeResponseV2(innerBytes);
    expect(result.tag).toBe('Success');
    if (result.tag === 'Success') {
      expect(Array.from(result.value.identityAccountId)).toEqual(Array.from(identityAccountId));
      expect(result.value.rootAccountId).toBeNull();
      expect(Array.from(result.value.identityChatPrivateKey)).toEqual(Array.from(identityChatPrivateKey));
      expect(Array.from(result.value.deviceEncPubKey)).toEqual(Array.from(deviceEncPubKey));
    }
  });

  it('decodes Pending(AllowanceAllocation)', () => {
    const innerBytes = EncryptedHandshakeResponseV2.enc({
      tag: 'Pending',
      value: { tag: 'AllowanceAllocation', value: undefined },
    });
    const result = decodeEncryptedHandshakeResponseV2(innerBytes);
    expect(result.tag).toBe('Pending');
  });

  it('decodes Failed with reason string', () => {
    const innerBytes = EncryptedHandshakeResponseV2.enc({ tag: 'Failed', value: 'no slot available' });
    const result = decodeEncryptedHandshakeResponseV2(innerBytes);
    expect(result.tag).toBe('Failed');
    if (result.tag === 'Failed') {
      expect(result.value).toBe('no slot available');
    }
  });

  it('throws on unexpected Success body length', () => {
    const innerBytes = new Uint8Array(50);
    innerBytes[0] = 0x01;
    expect(() => decodeEncryptedHandshakeResponseV2(innerBytes)).toThrow(/length/i);
  });

  it('throws on unknown tag', () => {
    expect(() => decodeEncryptedHandshakeResponseV2(new Uint8Array([0x99]))).toThrow(/tag/i);
  });
});
