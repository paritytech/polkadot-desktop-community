import { describe, expect, it } from 'vitest';

// Barrel-free wire-codec test: verifies the `deviceAdded` (variant #17) chat
// content survives a full device-sync `Messages` SyncEntity round-trip
// (encode → decode). This is the cross-device transport correctness for the
// scenario-3 fix: a sibling device must be able to decode the propagated
// peer-device addition. Imports only `./codec` (no app graph), so it runs
// without the full host-papp dependency tree.
import { SyncEntityCodec } from './codec';

describe('deviceAdded wire round-trip (device-sync Messages entity)', () => {
  it('encodes and decodes a Messages entity carrying a deviceAdded chat content', () => {
    const statementAccountId = new Uint8Array(32).fill(0xcd);
    const encryptionPublicKey = new Uint8Array(65).fill(0xef);
    const peerId = new Uint8Array(32).fill(0xaa);

    const entity = {
      tag: 'Messages' as const,
      value: [
        {
          remote: {
            messageId: `device-added:peer:${'cd'.repeat(32)}`,
            timestamp: 1_717_000_000_000n,
            versioned: {
              tag: 'v1' as const,
              value: { tag: 'deviceAdded' as const, value: { statementAccountId, encryptionPublicKey } },
            },
          },
          peerId,
          status: { tag: 'Incoming' as const, value: { tag: 'SEEN' as const, value: undefined } },
          order: 1_717_000_000_000n,
        },
      ],
    };

    const decoded = SyncEntityCodec.dec(SyncEntityCodec.enc(entity));

    expect(decoded.tag).toBe('Messages');
    if (decoded.tag !== 'Messages') throw new Error('unreachable');
    const content = decoded.value[0]!.remote.versioned;
    expect(content.tag).toBe('v1');
    if (content.tag !== 'v1') throw new Error('unreachable');
    expect(content.value.tag).toBe('deviceAdded');
    if (content.value.tag !== 'deviceAdded') throw new Error('unreachable');
    expect(content.value.value.statementAccountId).toEqual(statementAccountId);
    expect(content.value.value.encryptionPublicKey).toEqual(encryptionPublicKey);
    expect(decoded.value[0]!.status.tag).toBe('Incoming');
  });
});
