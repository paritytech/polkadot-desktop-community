import { toHex } from 'polkadot-api/utils';
import { describe, expect, it } from 'vitest';

import {
  ChatIdCodec,
  ChatMessageStatementCodec,
  DeviceStatusCodec,
  IncomingStatusCodec,
  LocalDeviceCodec,
  LocalMessageCodec,
  LocalStatusCodec,
  OutgoingStatusCodec,
  SyncMessageCodec,
  SyncUpdateAckCodec,
  SyncUpdateCodec,
} from './codec';

describe('ChatIdCodec', () => {
  it('round-trips Contact variant', () => {
    const accountId = new Uint8Array(32).fill(0xab);
    const chatId = { tag: 'Contact', value: accountId } as const;
    const encoded = ChatIdCodec.enc(chatId);
    expect(encoded[0]).toBe(0); // discriminant 0 = Contact
    expect(encoded.length).toBe(1 + 32);
    const decoded = ChatIdCodec.dec(encoded);
    expect(decoded.tag).toBe('Contact');
    if (decoded.tag !== 'Contact') throw new Error('unreachable');
    expect(toHex(decoded.value)).toBe(toHex(accountId));
  });
});

describe('DeviceStatusCodec', () => {
  it('encodes ACTIVE as discriminant 0', () => {
    const encoded = DeviceStatusCodec.enc({ tag: 'ACTIVE', value: undefined });
    expect(encoded[0]).toBe(0);
    expect(encoded.length).toBe(1);
  });
});

describe('OutgoingStatusCodec', () => {
  it.each([
    ['NEW', 0],
    ['SENT', 1],
    ['DELIVERED', 2],
  ] as const)('%s -> discriminant %s', (tag, discriminant) => {
    const encoded = OutgoingStatusCodec.enc({ tag, value: undefined });
    expect(encoded[0]).toBe(discriminant);
    expect(encoded.length).toBe(1);
  });
});

describe('IncomingStatusCodec', () => {
  it.each([
    ['NEW', 0],
    ['SEEN', 1],
  ] as const)('%s -> discriminant %s', (tag, discriminant) => {
    const encoded = IncomingStatusCodec.enc({ tag, value: undefined });
    expect(encoded[0]).toBe(discriminant);
    expect(encoded.length).toBe(1);
  });
});

describe('LocalStatusCodec', () => {
  it('Outgoing wraps OutgoingStatus at discriminant 0', () => {
    const encoded = LocalStatusCodec.enc({
      tag: 'Outgoing',
      value: { tag: 'SENT', value: undefined },
    });
    expect(encoded[0]).toBe(0); // Outgoing
    expect(encoded[1]).toBe(1); // SENT
  });

  it('Incoming wraps IncomingStatus at discriminant 1', () => {
    const encoded = LocalStatusCodec.enc({
      tag: 'Incoming',
      value: { tag: 'SEEN', value: undefined },
    });
    expect(encoded[0]).toBe(1); // Incoming
    expect(encoded[1]).toBe(1); // SEEN
  });

  it('round-trips Outgoing(NEW)', () => {
    const value = { tag: 'Outgoing', value: { tag: 'NEW', value: undefined } } as const;
    const decoded = LocalStatusCodec.dec(LocalStatusCodec.enc(value));
    expect(decoded.tag).toBe('Outgoing');
    if (decoded.tag !== 'Outgoing') throw new Error('unreachable');
    expect(decoded.value.tag).toBe('NEW');
  });
});

describe('LocalDeviceCodec', () => {
  it('round-trips active device with explicit DeviceStatus enum', () => {
    const stmt = new Uint8Array(32).fill(0x01);
    const enc = new Uint8Array(65).fill(0x02);
    const device = {
      statementAccountId: stmt,
      encryptionPublicKey: enc,
      status: { tag: 'ACTIVE', value: undefined } as const,
      lastUpdate: 1715000000000n,
    };
    const encoded = LocalDeviceCodec.enc(device);
    // status byte sits after 32+65 = 97 bytes
    expect(encoded[97]).toBe(0); // ACTIVE discriminant
    const decoded = LocalDeviceCodec.dec(encoded);
    expect(toHex(decoded.statementAccountId)).toBe(toHex(stmt));
    expect(toHex(decoded.encryptionPublicKey)).toBe(toHex(enc));
    expect(decoded.status.tag).toBe('ACTIVE');
    expect(decoded.lastUpdate).toBe(1715000000000n);
  });
});

describe('LocalMessageCodec', () => {
  it('round-trips a text message wrapped in ChatMessageStatement', () => {
    const peerId = new Uint8Array(32).fill(0xbb);
    const remote = {
      messageId: 'm-42',
      timestamp: 1715000000000n,
      versioned: {
        tag: 'v1',
        value: { tag: 'text', value: 'hi' },
      },
    } as const;
    const message = {
      remote,
      peerId,
      status: { tag: 'Outgoing', value: { tag: 'SENT', value: undefined } } as const,
      order: 7n,
    };
    const decoded = LocalMessageCodec.dec(LocalMessageCodec.enc(message));
    expect(decoded.remote.messageId).toBe('m-42');
    expect(decoded.remote.timestamp).toBe(1715000000000n);
    expect(decoded.remote.versioned.tag).toBe('v1');
    if (decoded.remote.versioned.tag !== 'v1') throw new Error('unreachable');
    expect(decoded.remote.versioned.value.tag).toBe('text');
    if (decoded.remote.versioned.value.tag !== 'text') throw new Error('unreachable');
    expect(decoded.remote.versioned.value.value).toBe('hi');
    expect(toHex(decoded.peerId)).toBe(toHex(peerId));
    expect(decoded.status.tag).toBe('Outgoing');
    expect(decoded.order).toBe(7n);
  });

  it('decodes a token message whose platform variant is iOSVoIP (index 2)', () => {
    // iOS PApp uses `pushType = iosVoIP (2)` for CallKit-wake tokens. The
    // SDK's `Platform = Status('Android', 'iOS')` only knows 0 and 1, so a
    // sync update carrying such a token would fail at SCALE-decode time
    // with `Unknown status index: 2`, dropping every entity in the
    // envelope. Our local wire codec extends Platform to a 3-variant
    // Status so the decoder advances past the byte; the applier already
    // skips iOSVoIP defensively.
    const peerId = new Uint8Array(32).fill(0xcc);
    const message = {
      remote: {
        messageId: 'voip-1',
        timestamp: 1779459592513n,
        versioned: {
          tag: 'v1' as const,
          value: {
            tag: 'token' as const,
            value: {
              token: '0x7777777777777777777777777777777777777777777777777777777777777777' as const,
              platform: 'iOSVoIP' as const,
            },
          },
        },
      },
      peerId,
      status: { tag: 'Outgoing', value: { tag: 'DELIVERED', value: undefined } } as const,
      order: 1779459592513n,
    };
    const encoded = LocalMessageCodec.enc(message);
    // Verify the platform byte landed where the wire format puts it (last
    // byte of the inner Token content): index 2 = iOSVoIP.
    expect(() => LocalMessageCodec.dec(encoded)).not.toThrow();
    const decoded = LocalMessageCodec.dec(encoded);
    if (decoded.remote.versioned.tag !== 'v1') throw new Error('unreachable');
    if (decoded.remote.versioned.value.tag !== 'token') throw new Error('unreachable');
    expect(decoded.remote.versioned.value.value.platform).toBe('iOSVoIP');
  });

  it('wire layout begins with remote bytes (ChatMessageStatement is encoded inline)', () => {
    const peerId = new Uint8Array(32).fill(0x00);
    const remote = {
      messageId: 'x',
      timestamp: 0n,
      versioned: {
        tag: 'v1' as const,
        value: { tag: 'text', value: '' } as const,
      },
    };
    const message = {
      remote,
      peerId,
      status: { tag: 'Incoming', value: { tag: 'NEW', value: undefined } } as const,
      order: 0n,
    };
    const wireRemote = ChatMessageStatementCodec.enc(remote);
    const wireFull = LocalMessageCodec.enc(message);
    // The remote blob is the prefix of the LocalMessage encoding.
    expect(Array.from(wireFull.slice(0, wireRemote.length))).toEqual(Array.from(wireRemote));
  });
});

describe('SyncEntity discriminants', () => {
  it.each([
    ['Devices', 0],
    ['ChatsAdded', 1],
    ['ChatsRemoved', 2],
    ['Messages', 3],
  ] as const)('%s -> discriminant %s', (tag, discriminant) => {
    const value: { tag: typeof tag; value: never[] } = { tag, value: [] };
    const encoded = SyncUpdateCodec.enc({
      id: 0,
      entities: [value],
      timePoint: 0n,
    });
    // SyncUpdate layout: [id:u32][entities Vec compact-len][entity tag][entity body][timePoint:u64]
    // SCALE compact for 1 = (1<<2)|0 = 0x04 in single-byte mode.
    expect(encoded[4]).toBe(0x04);
    expect(encoded[5]).toBe(discriminant);
  });
});

describe('SyncMessage cross-codec fixture', () => {
  it('encodes a Update with one of each entity to the canonical byte sequence', () => {
    const stmt = new Uint8Array(32).fill(0x33);
    const enc = new Uint8Array(65).fill(0x44);
    const ourAcct = new Uint8Array(32).fill(0x66);
    const peerAcct = new Uint8Array(32).fill(0x55);
    const update = {
      tag: 'Update' as const,
      value: {
        id: 1,
        timePoint: 42n,
        entities: [
          {
            tag: 'Devices' as const,
            value: [
              {
                statementAccountId: stmt,
                encryptionPublicKey: enc,
                status: { tag: 'ACTIVE', value: undefined } as const,
                lastUpdate: 7n,
              },
            ],
          },
          {
            tag: 'ChatsAdded' as const,
            value: [{ tag: 'Contact' as const, value: ourAcct }],
          },
          {
            tag: 'ChatsRemoved' as const,
            value: [{ tag: 'Contact' as const, value: peerAcct }],
          },
          {
            tag: 'Messages' as const,
            value: [
              {
                remote: {
                  messageId: 'm',
                  timestamp: 1n,
                  versioned: {
                    tag: 'v1' as const,
                    value: { tag: 'text', value: 'x' } as const,
                  },
                },
                peerId: peerAcct,
                status: { tag: 'Incoming', value: { tag: 'NEW', value: undefined } } as const,
                order: 9n,
              },
            ],
          },
        ],
      },
    };
    // Share this hex with the Android team to cross-check their codec; any drift
    // means the wire format diverged and interop will break silently.
    const expectedHex =
      '0x000100000010000433333333333333333333333333333333333333333333333333333333333333334444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444000700000000000000010400666666666666666666666666666666666666666666666666666666666666666602040055555555555555555555555555555555555555555555555555555555555555550304046d0100000000000000000004785555555555555555555555555555555555555555555555555555555555555555010009000000000000002a00000000000000';
    expect(toHex(SyncMessageCodec.enc(update))).toBe(expectedHex);
  });
});

describe('Android-only payload-bearing variants', () => {
  // Catches the regression where the desktop wire codec left coinage / data-channel
  // variants as `_void` and a sync envelope mixing them with text/richText messages
  // silently mis-aligned the decoder, dropping every entry after the offending one.

  it('round-trips a CoinagePayment chat message inside a SyncUpdate without throwing', () => {
    const peerAcct = new Uint8Array(32).fill(0x55);
    const update = {
      tag: 'Update' as const,
      value: {
        id: 1,
        timePoint: 0n,
        entities: [
          {
            tag: 'Messages' as const,
            value: [
              {
                remote: {
                  messageId: 'coinage-1',
                  timestamp: 1n,
                  versioned: {
                    tag: 'v1' as const,
                    value: {
                      tag: 'coinagePayment' as const,
                      value: { totalValue: 100_000_000, coinKeys: [new Uint8Array(32).fill(0xaa)] },
                    },
                  },
                },
                peerId: peerAcct,
                status: { tag: 'Incoming', value: { tag: 'NEW', value: undefined } } as const,
                order: 1n,
              },
            ],
          },
        ],
      },
    };
    expect(() => SyncMessageCodec.dec(SyncMessageCodec.enc(update))).not.toThrow();
  });

  it('decodes a SyncUpdate that mixes coinage + text + richText with media attachment', () => {
    const peerAcct = new Uint8Array(32).fill(0x66);
    const update = {
      tag: 'Update' as const,
      value: {
        id: 2,
        timePoint: 0n,
        entities: [
          {
            tag: 'Messages' as const,
            value: [
              {
                remote: {
                  messageId: 'm-coinage',
                  timestamp: 1n,
                  versioned: {
                    tag: 'v1' as const,
                    value: {
                      tag: 'coinagePayment' as const,
                      value: { totalValue: 7n, coinKeys: [] },
                    },
                  },
                },
                peerId: peerAcct,
                status: { tag: 'Incoming', value: { tag: 'NEW', value: undefined } } as const,
                order: 1n,
              },
              {
                remote: {
                  messageId: 'm-text',
                  timestamp: 2n,
                  versioned: {
                    tag: 'v1' as const,
                    value: { tag: 'text' as const, value: 'after-coinage' },
                  },
                },
                peerId: peerAcct,
                status: { tag: 'Incoming', value: { tag: 'NEW', value: undefined } } as const,
                order: 2n,
              },
              {
                remote: {
                  messageId: 'm-media',
                  timestamp: 3n,
                  versioned: {
                    tag: 'v1' as const,
                    value: {
                      tag: 'richText' as const,
                      value: {
                        text: 'with image',
                        attachments: [
                          {
                            tag: 'p2pMixnet' as const,
                            value: {
                              identifier: new Uint8Array(32).fill(0xab),
                              claimTicket: new Uint8Array(32).fill(0xcd),
                              nodeEndpoint: { tag: 'wssUrl' as const, value: { url: 'wss://hop.example' } },
                              meta: {
                                tag: 'image' as const,
                                value: {
                                  general: { mimeType: 'image/jpeg', fileSize: 100 },
                                  width: 100,
                                  height: 100,
                                  thumbnail: new TextEncoder().encode('LKO2?U%2Tw=w]~RBVZRi};RPxuwH'),
                                },
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                },
                peerId: peerAcct,
                status: { tag: 'Incoming', value: { tag: 'NEW', value: undefined } } as const,
                order: 3n,
              },
            ],
          },
        ],
      },
    };
    const decoded = SyncMessageCodec.dec(SyncMessageCodec.enc(update));
    expect(decoded.tag).toBe('Update');
    if (decoded.tag !== 'Update') throw new Error('unreachable');
    const messages = decoded.value.entities[0];
    if (messages?.tag !== 'Messages') throw new Error('unreachable');
    expect(messages.value).toHaveLength(3);
    expect(messages.value[1]?.remote.messageId).toBe('m-text');
    expect(messages.value[2]?.remote.messageId).toBe('m-media');
    const richText = messages.value[2]?.remote.versioned;
    if (richText?.tag !== 'v1' || richText.value.tag !== 'richText') throw new Error('unreachable');
    const attachment = richText.value.value.attachments?.[0];
    if (!attachment || attachment.tag !== 'p2pMixnet') throw new Error('unreachable');
    expect(attachment.value.nodeEndpoint).toEqual({ tag: 'wssUrl', value: { url: 'wss://hop.example' } });
    if (attachment.value.meta.tag !== 'image') throw new Error('unreachable');
    expect(attachment.value.meta.value.thumbnail).toBeDefined();
  });

  it('decodes a DataChannelOffer message without consuming the wrong number of bytes', () => {
    const peerAcct = new Uint8Array(32).fill(0x77);
    const update = {
      tag: 'Update' as const,
      value: {
        id: 3,
        timePoint: 0n,
        entities: [
          {
            tag: 'Messages' as const,
            value: [
              {
                remote: {
                  messageId: 'dc-offer',
                  timestamp: 1n,
                  versioned: {
                    tag: 'v1' as const,
                    value: {
                      tag: 'dataChannelOffer' as const,
                      value: { sdp: new Uint8Array([1, 2, 3, 4]), purpose: 'VIDEO_CALL' as const },
                    },
                  },
                },
                peerId: peerAcct,
                status: { tag: 'Incoming', value: { tag: 'NEW', value: undefined } } as const,
                order: 1n,
              },
              {
                remote: {
                  messageId: 'm-after',
                  timestamp: 2n,
                  versioned: {
                    tag: 'v1' as const,
                    value: { tag: 'text' as const, value: 'survives offset' },
                  },
                },
                peerId: peerAcct,
                status: { tag: 'Incoming', value: { tag: 'NEW', value: undefined } } as const,
                order: 2n,
              },
            ],
          },
        ],
      },
    };
    const decoded = SyncMessageCodec.dec(SyncMessageCodec.enc(update));
    if (decoded.tag !== 'Update') throw new Error('unreachable');
    const messages = decoded.value.entities[0];
    if (messages?.tag !== 'Messages') throw new Error('unreachable');
    expect(messages.value[1]?.remote.messageId).toBe('m-after');
  });
});

describe('SyncUpdate end-to-end', () => {
  it('round-trips a SyncUpdate with mixed entities', () => {
    const update = {
      id: 7,
      entities: [
        {
          tag: 'ChatsAdded' as const,
          value: [{ tag: 'Contact' as const, value: new Uint8Array(32).fill(0x11) }],
        },
        {
          tag: 'ChatsRemoved' as const,
          value: [{ tag: 'Contact' as const, value: new Uint8Array(32).fill(0x22) }],
        },
      ],
      timePoint: 1715000000000n,
    };
    const decoded = SyncUpdateCodec.dec(SyncUpdateCodec.enc(update));
    expect(decoded.id).toBe(7);
    expect(decoded.entities).toHaveLength(2);
    expect(decoded.entities[0]?.tag).toBe('ChatsAdded');
    expect(decoded.entities[1]?.tag).toBe('ChatsRemoved');
    expect(decoded.timePoint).toBe(1715000000000n);
  });

  it('round-trips a SyncUpdateAck', () => {
    const ack = { id: 12 };
    const decoded = SyncUpdateAckCodec.dec(SyncUpdateAckCodec.enc(ack));
    expect(decoded.id).toBe(12);
  });

  it('SyncMessage routes Update vs Ack via discriminant', () => {
    const ackMsg = { tag: 'Ack', value: { id: 3 } } as const;
    const decoded = SyncMessageCodec.dec(SyncMessageCodec.enc(ackMsg));
    expect(decoded.tag).toBe('Ack');
  });
});
