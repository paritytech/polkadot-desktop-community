import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { DEVICE_SYNC_USE_CASE_ID, DataChannelMessageCodec } from '@/shared/peer-channel';

import { SyncMessageCodec } from './codec';
import { startSyncStateMachine } from './syncStateMachine';

function makeFakeChannel() {
  const sent: Uint8Array[] = [];
  const messages$ = new Subject<MessageEvent<ArrayBuffer | Uint8Array>>();
  /* eslint-disable @typescript-eslint/consistent-type-assertions -- test mock channel */
  const channel = {
    send: (data: Uint8Array) => sent.push(data),
    addEventListener: (ev: string, cb: (e: MessageEvent<ArrayBuffer | Uint8Array>) => void) => {
      if (ev === 'message') messages$.subscribe({ next: e => cb(e) });
    },
    removeEventListener: () => {},
  } as unknown as RTCDataChannel;
  /* eslint-enable @typescript-eslint/consistent-type-assertions */
  return { channel, sent, messages$ };
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function decodeUpdateId(bytes: Uint8Array): number {
  const sync = SyncMessageCodec.dec(DataChannelMessageCodec.dec(bytes).data);
  if (sync.tag !== 'Update') throw new Error('expected Update');
  return sync.value.id;
}

describe('startSyncStateMachine', () => {
  it('on first pump with empty changes, sends nothing', async () => {
    const { channel, sent } = makeFakeChannel();

    const handle = startSyncStateMachine({
      peerStatementAccountId: '0xpeer',
      dataChannel: channel,
      collect: async () => ({ entities: [], timePoint: 0 }),
      apply: async () => {},
      getOutgoingUpdateTime: async () => 0,
      advanceOutgoingUpdateTime: async () => {},
    });

    await delay(10);
    expect(sent).toHaveLength(0);
    handle.close();
  });

  it('sends SyncUpdate when collector returns entities, advances on Ack', async () => {
    const { channel, sent, messages$ } = makeFakeChannel();
    let advanced = 0;

    const handle = startSyncStateMachine({
      peerStatementAccountId: '0xpeer',
      dataChannel: channel,
      collect: async () => ({
        entities: [
          {
            tag: 'ChatsAdded' as const,
            value: [{ tag: 'Contact' as const, value: new Uint8Array(32).fill(0xab) }],
          },
        ],
        timePoint: 999,
      }),
      apply: async () => {},
      getOutgoingUpdateTime: async () => 0,
      advanceOutgoingUpdateTime: async (_id, t) => {
        advanced = t;
      },
    });

    await delay(10);
    expect(sent).toHaveLength(1);

    const env = DataChannelMessageCodec.dec(sent[0]!);
    const sync = SyncMessageCodec.dec(env.data);
    expect(sync.tag).toBe('Update');
    if (sync.tag !== 'Update') throw new Error('unreachable');
    const sentId = sync.value.id;

    const ackBytes = DataChannelMessageCodec.enc({
      id: DEVICE_SYNC_USE_CASE_ID,
      data: SyncMessageCodec.enc({ tag: 'Ack', value: { id: sentId } }),
    });
    /* eslint-disable @typescript-eslint/consistent-type-assertions -- test mock event */
    messages$.next({ data: ackBytes.buffer } as MessageEvent<ArrayBuffer>);
    /* eslint-enable @typescript-eslint/consistent-type-assertions */

    await delay(10);
    expect(advanced).toBe(999);
    handle.close();
  });

  it('resends Update with a fresh id and does not advance when no Ack arrives within the timeout', async () => {
    const { channel, sent } = makeFakeChannel();
    let advanced = 0;

    const handle = startSyncStateMachine({
      peerStatementAccountId: '0xpeer',
      dataChannel: channel,
      collect: async () => ({
        entities: [
          {
            tag: 'ChatsAdded' as const,
            value: [{ tag: 'Contact' as const, value: new Uint8Array(32).fill(0xab) }],
          },
        ],
        timePoint: 999,
      }),
      apply: async () => {},
      getOutgoingUpdateTime: async () => 0,
      advanceOutgoingUpdateTime: async (_id, t) => {
        advanced = t;
      },
      ackTimeoutMs: 20,
    });

    await delay(10);
    expect(sent).toHaveLength(1);
    const firstId = decodeUpdateId(sent[0]!);

    // No Ack — after the timeout the Update is re-pumped with a new id.
    await delay(40);
    expect(sent.length).toBeGreaterThanOrEqual(2);
    const secondId = decodeUpdateId(sent[1]!);
    expect(secondId).not.toBe(firstId);
    // Cursor never advances without an Ack.
    expect(advanced).toBe(0);
    handle.close();
  });

  it('a matching Ack before the timeout cancels the resend', async () => {
    const { channel, sent, messages$ } = makeFakeChannel();
    // First batch has changes; after it is acked the cursor advances, so collect() is empty.
    let collected = false;

    const handle = startSyncStateMachine({
      peerStatementAccountId: '0xpeer',
      dataChannel: channel,
      collect: async () => {
        if (collected) return { entities: [], timePoint: 999 };
        collected = true;
        return {
          entities: [
            {
              tag: 'ChatsAdded' as const,
              value: [{ tag: 'Contact' as const, value: new Uint8Array(32).fill(0xab) }],
            },
          ],
          timePoint: 999,
        };
      },
      apply: async () => {},
      getOutgoingUpdateTime: async () => 0,
      advanceOutgoingUpdateTime: async () => {},
      ackTimeoutMs: 50,
    });

    await delay(10);
    expect(sent).toHaveLength(1);
    const sentId = decodeUpdateId(sent[0]!);

    const ackBytes = DataChannelMessageCodec.enc({
      id: DEVICE_SYNC_USE_CASE_ID,
      data: SyncMessageCodec.enc({ tag: 'Ack', value: { id: sentId } }),
    });
    /* eslint-disable @typescript-eslint/consistent-type-assertions -- test mock event */
    messages$.next({ data: ackBytes.buffer } as MessageEvent<ArrayBuffer>);
    /* eslint-enable @typescript-eslint/consistent-type-assertions */

    // collect() now yields nothing, so the post-Ack pump sends no new Update and the
    // timer must not fire a resend either.
    await delay(80);
    expect(sent).toHaveLength(1);
    handle.close();
  });
});
