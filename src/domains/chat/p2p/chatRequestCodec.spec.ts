// src/domains/chat/p2p/chatRequestCodec.spec.ts
import { createAccountId } from '@novasamatech/statement-store';
import { describe, expect, it } from 'vitest';

import {
  EncryptedRemoteModel,
  MultiDeviceRequest,
  MultiDeviceResponse,
  ProofPayload,
  RemoteModel,
  RequestContentV2,
  RequestDeviceInfo,
  RequestMessage,
  VersionedRequestContent,
} from './chatRequestCodec';

const makeRequestMessage = (overrides?: Partial<{ messageId: string; welcomeText: string }>) => ({
  messageId: overrides?.messageId ?? 'test-message-id',
  timestamp: BigInt(1_700_000_000_000),
  content: {
    tag: 'v1' as const,
    value: {
      pushToken: undefined,
      welcomeMessage: overrides?.welcomeText ? { text: overrides.welcomeText, attachments: undefined } : undefined,
    },
  },
});

describe('RequestMessage', () => {
  it('round-trips without welcome message', () => {
    const msg = makeRequestMessage();
    expect(RequestMessage.dec(RequestMessage.enc(msg))).toEqual(msg);
  });

  it('round-trips with welcome message', () => {
    const msg = makeRequestMessage({ welcomeText: 'Hey, want to chat?' });
    expect(RequestMessage.dec(RequestMessage.enc(msg))).toEqual(msg);
  });

  it('is deterministic', () => {
    const msg = makeRequestMessage();
    expect(RequestMessage.enc(msg)).toEqual(RequestMessage.enc(msg));
  });

  it('round-trips with a custom messageId', () => {
    const msg = makeRequestMessage({ messageId: 'unique-id-abc-123' });
    expect(RequestMessage.dec(RequestMessage.enc(msg))).toEqual(msg);
  });

  // iOS wire format baseline — on first run Vitest captures the bytes;
  // verify the hex matches the equivalent Swift ChatRequestFactory.swift output.
  it('encodes to a stable wire format (iOS compatibility baseline)', () => {
    const msg = makeRequestMessage({ messageId: 'abc123', welcomeText: 'Hi!' });
    const hex = Array.from(RequestMessage.enc(msg))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    expect(hex).toMatchInlineSnapshot(`"186162633132330068e5cf8b010000000001010c48692100"`);
  });
});

describe('ProofPayload', () => {
  it('round-trips', () => {
    const payload = {
      message: makeRequestMessage(),
      requestAcceptorId: createAccountId(new Uint8Array(32).fill(0xaa)),
    };
    expect(ProofPayload.dec(ProofPayload.enc(payload))).toEqual(payload);
  });

  it('round-trips with welcome message', () => {
    const payload = {
      message: makeRequestMessage({ welcomeText: 'Hello!' }),
      requestAcceptorId: createAccountId(new Uint8Array(32).fill(0x01)),
    };
    expect(ProofPayload.dec(ProofPayload.enc(payload))).toEqual(payload);
  });
});

describe('RemoteModel', () => {
  it('round-trips with sr25519 proof', () => {
    const model = {
      message: makeRequestMessage(),
      proof: {
        tag: 'sr25519' as const,
        value: {
          signature: new Uint8Array(64).fill(0xbb),
          signer: new Uint8Array(32).fill(0xcc),
        },
      },
    };
    expect(RemoteModel.dec(RemoteModel.enc(model))).toEqual(model);
  });

  it('round-trips with ed25519 proof', () => {
    const model = {
      message: makeRequestMessage(),
      proof: {
        tag: 'ed25519' as const,
        value: {
          signature: new Uint8Array(64).fill(0xdd),
          signer: new Uint8Array(32).fill(0xee),
        },
      },
    };
    expect(RemoteModel.dec(RemoteModel.enc(model))).toEqual(model);
  });

  it('preserves distinct sr25519 signature and signer bytes', () => {
    const signature = new Uint8Array(64).fill(0x01);
    const signer = new Uint8Array(32).fill(0x02);
    const model = {
      message: makeRequestMessage(),
      proof: { tag: 'sr25519' as const, value: { signature, signer } },
    };
    const decoded = RemoteModel.dec(RemoteModel.enc(model));
    expect(decoded.proof.value.signature).toEqual(signature);
    expect(decoded.proof.value.signer).toEqual(signer);
  });
});

describe('EncryptedRemoteModel', () => {
  it('round-trips', () => {
    const model = {
      encryptionPubKey: new Uint8Array(65).fill(0xff),
      encryptedData: new Uint8Array(48).fill(0x12),
    };
    expect(EncryptedRemoteModel.dec(EncryptedRemoteModel.enc(model))).toEqual(model);
  });

  it('handles variable-length encryptedData', () => {
    const short = { encryptionPubKey: new Uint8Array(65), encryptedData: new Uint8Array(1) };
    const long = { encryptionPubKey: new Uint8Array(65), encryptedData: new Uint8Array(512) };
    expect(EncryptedRemoteModel.dec(EncryptedRemoteModel.enc(short))).toEqual(short);
    expect(EncryptedRemoteModel.dec(EncryptedRemoteModel.enc(long))).toEqual(long);
  });

  it('handles empty encryptedData', () => {
    const model = { encryptionPubKey: new Uint8Array(65).fill(0xab), encryptedData: new Uint8Array(0) };
    expect(EncryptedRemoteModel.dec(EncryptedRemoteModel.enc(model))).toEqual(model);
  });

  // iOS wire format baseline — on first run Vitest captures the bytes;
  // verify the hex matches the equivalent Swift EncryptedRemoteModel.swift output.
  it('encodes to a stable wire format (iOS compatibility baseline)', () => {
    const model = {
      encryptionPubKey: new Uint8Array(65).fill(0x04),
      encryptedData: new Uint8Array(16).fill(0xab),
    };
    const hex = Array.from(EncryptedRemoteModel.enc(model))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    expect(hex).toMatchInlineSnapshot(
      `"0501040404040404040404040404040404040404040404040404040404040404040404040404040404040404040404040404040404040404040404040404040404040440abababababababababababababababab"`,
    );
  });
});

describe('RequestContentV2', () => {
  const fullV2 = () => ({
    identityProof: {
      identityAccountId: new Uint8Array(32).fill(0xa1),
      proof: new Uint8Array(32).fill(0xcc),
    },
    deviceEncPubKey: new Uint8Array(65).fill(0x10),
    pushToken: undefined,
    welcomeMessage: { text: 'Hi!', attachments: undefined },
  });

  it('round-trips with all optional fields populated', () => {
    const content = fullV2();
    expect(RequestContentV2.dec(RequestContentV2.enc(content))).toEqual(content);
  });

  it('round-trips with welcomeMessage and pushToken omitted', () => {
    const content = { ...fullV2(), pushToken: undefined, welcomeMessage: undefined };
    expect(RequestContentV2.dec(RequestContentV2.enc(content))).toEqual(content);
  });
});

describe('VersionedRequestContent', () => {
  const v2Content = () => ({
    identityProof: {
      identityAccountId: new Uint8Array(32).fill(0xa1),
      proof: new Uint8Array(32).fill(0xcc),
    },
    deviceEncPubKey: new Uint8Array(65).fill(0x10),
    pushToken: undefined,
    welcomeMessage: undefined,
  });

  it('encodes v1 with the legacy 0x00 discriminator (non-breaking)', () => {
    const v1 = {
      tag: 'v1' as const,
      value: { pushToken: undefined, welcomeMessage: undefined },
    };
    expect(VersionedRequestContent.enc(v1)[0]).toBe(0x00);
  });

  it('encodes v2 with the 0x01 discriminator', () => {
    const v2 = { tag: 'v2' as const, value: v2Content() };
    expect(VersionedRequestContent.enc(v2)[0]).toBe(0x01);
  });

  it('round-trips a v2 variant through RequestMessage', () => {
    const msg = {
      messageId: 'v2-msg-1',
      timestamp: BigInt(1_700_000_000_000),
      content: {
        tag: 'v2' as const,
        value: { ...v2Content(), welcomeMessage: { text: 'Multi-device hello', attachments: undefined } },
      },
    };
    expect(RequestMessage.dec(RequestMessage.enc(msg))).toEqual(msg);
  });
});

describe('RequestDeviceInfo', () => {
  it('round-trips with arbitrary encrypted-key length', () => {
    const info = {
      statementAccountId: new Uint8Array(32).fill(0xaa),
      encryptedKey: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
    };
    expect(RequestDeviceInfo.dec(RequestDeviceInfo.enc(info))).toEqual(info);
  });

  it('handles an empty encrypted key (degenerate case)', () => {
    const info = { statementAccountId: new Uint8Array(32), encryptedKey: new Uint8Array(0) };
    expect(RequestDeviceInfo.dec(RequestDeviceInfo.enc(info))).toEqual(info);
  });
});

describe('MultiDeviceRequest', () => {
  it('round-trips with one recipient device', () => {
    const m = {
      encryptedRequest: new Uint8Array([1, 2, 3]),
      devicesInfo: [
        {
          statementAccountId: new Uint8Array(32).fill(0xa1),
          encryptedKey: new Uint8Array([0xde, 0xad]),
        },
      ],
    };
    expect(MultiDeviceRequest.dec(MultiDeviceRequest.enc(m))).toEqual(m);
  });

  it('round-trips with multiple recipient devices (per-device key wrap)', () => {
    const m = {
      encryptedRequest: new Uint8Array(64).fill(0x42),
      devicesInfo: [
        { statementAccountId: new Uint8Array(32).fill(0x01), encryptedKey: new Uint8Array(48).fill(0xaa) },
        { statementAccountId: new Uint8Array(32).fill(0x02), encryptedKey: new Uint8Array(48).fill(0xbb) },
        { statementAccountId: new Uint8Array(32).fill(0x03), encryptedKey: new Uint8Array(48).fill(0xcc) },
      ],
    };
    expect(MultiDeviceRequest.dec(MultiDeviceRequest.enc(m))).toEqual(m);
  });

  it('round-trips with no recipient devices (degenerate case)', () => {
    const m = { encryptedRequest: new Uint8Array(0), devicesInfo: [] };
    expect(MultiDeviceRequest.dec(MultiDeviceRequest.enc(m))).toEqual(m);
  });
});

describe('MultiDeviceResponse', () => {
  it('round-trips with one device', () => {
    const m = {
      encryptedResponse: new Uint8Array([9, 9, 9]),
      devicesInfo: [{ statementAccountId: new Uint8Array(32).fill(0xff), encryptedKey: new Uint8Array([0x77]) }],
    };
    expect(MultiDeviceResponse.dec(MultiDeviceResponse.enc(m))).toEqual(m);
  });
});
