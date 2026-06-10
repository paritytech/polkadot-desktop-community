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

    await new Promise(r => setTimeout(r, 10));
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

    await new Promise(r => setTimeout(r, 10));
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

    await new Promise(r => setTimeout(r, 10));
    expect(advanced).toBe(999);
    handle.close();
  });
});
