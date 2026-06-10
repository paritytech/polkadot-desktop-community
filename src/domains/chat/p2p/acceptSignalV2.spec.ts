import { type CodecType } from 'scale-ts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { decodeEventsFromChatMessage } from './acceptSignalV2';
import { ChatMessage as ChatMessageCodec } from './wireChatMessage';

type ChatMessageInput = CodecType<typeof ChatMessageCodec>;

const encodeChatMessage = (timestamp: number, content: ChatMessageInput['versioned']['value']): Uint8Array =>
  ChatMessageCodec.enc({
    messageId: 'msg-1',
    timestamp: BigInt(timestamp),
    versioned: { tag: 'v1', value: content },
  });

describe('decodeEventsFromChatMessage iOS VoIP token', () => {
  afterEach(() => vi.restoreAllMocks());

  it('decodes an iOSVoIP push token (platform index 2) without a decode failure', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bytes = encodeChatMessage(1_700_000_000_000, {
      tag: 'token',
      value: { token: '0xcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd', platform: 'iOSVoIP' },
    });

    const events = decodeEventsFromChatMessage(bytes);

    // A token carries no identity-channel event, but it must not throw/be dropped.
    expect(events).toEqual([]);
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('ChatMessage decode failed'), expect.anything());
  });
});

describe('decodeEventsFromChatMessage acceptedAt', () => {
  it('carries the wire timestamp on a deviceChatAccepted accept signal', () => {
    const acceptedAt = 1_700_000_000_000;
    const bytes = encodeChatMessage(acceptedAt, {
      tag: 'deviceChatAccepted',
      value: {
        requestId: 'req-1',
        device: {
          statementAccountId: new Uint8Array(32).fill(0xaa),
          encryptionPublicKey: new Uint8Array(33).fill(0xbb),
        },
      },
    });

    const events = decodeEventsFromChatMessage(bytes);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ tag: 'acceptSignal', signal: { requestId: 'req-1', acceptedAt } });
  });

  it('drops Android-legacy chatAccepted @14 signals (no DeviceInfo on the wire)', () => {
    // Accepting chatAccepted @14 would force the matcher into the
    // identity-conflated synthetic-device fallback, which the peer cannot
    // decrypt (bug #9, blocked-on-Android). Decoder must drop these silently
    // until Android emits deviceChatAccepted @20.
    const acceptedAt = 1_700_000_999_000;
    const bytes = encodeChatMessage(acceptedAt, { tag: 'chatAccepted', value: { messageId: 'req-2' } });

    const events = decodeEventsFromChatMessage(bytes);

    expect(events).toHaveLength(0);
  });
});
