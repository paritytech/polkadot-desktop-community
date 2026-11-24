import 'fake-indexeddb/auto';

import { type UpdatingHookContext } from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environmentUseCase } from '@/domains/application';
import { contactRepository } from '@/domains/contact';
import { type ChatMessage, type MessageContent, type MessagePosition } from '../session/types';

import { pushNotificationGateway } from './notifications/gateway';
import { peerGateway } from './peer/gateway';
import { p2pChatDatabase } from './repository';
import { chatRequestGateway } from './requests/gateway';
import { p2pService } from './service';
import { type P2PRoom } from './types';

const OWN_USER_ID = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const PEER_ID = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';

// The callback the peer's messages arrive on, captured so tests can drive it.
let capturedOnMessage: ((msg: { messageId: string; timestamp: number; content: unknown }) => void) | null = null;
const sendSeenSpy = vi.fn();

// `createP2PChatManagerV2` takes no session factory as a parameter, so replacing the module is
// the only seam until it does.
vi.mock('./chatSessionV2', () => ({
  createChatPeerSessionV2: (params: { onMessage: (msg: { messageId: string; timestamp: number; content: unknown }) => void }) => {
    capturedOnMessage = params.onMessage;
    return { send: vi.fn().mockResolvedValue({ messageId: 'm', timestamp: 1 }), sendSeen: sendSeenSpy, dispose: vi.fn() };
  },
  isMessageTooLargeError: () => false,
}));

// `createP2PChatManagerV2` takes no identity-channel factory as a parameter, so replacing the
// module is the only seam until it does.
vi.mock('./identityChannel', () => ({
  createIdentityChannel: () => ({ post: vi.fn().mockResolvedValue(undefined), dispose: vi.fn() }),
}));

// `createP2PChatManagerV2` takes no subscription factory as a parameter, and
// `trackedSubscribeStatements` is a bare function export nothing can spy on in place, so
// replacing the module is the only seam until the manager takes its transport as a parameter.
vi.mock('./subscription-registry', () => ({
  trackedSubscribeStatements: vi.fn().mockReturnValue(() => {}),
}));

// Every wire gateway is a plain object, spied in place so no statement, request or push
// leaves the process; the active environment is spied the same way. The device-sync
// repository runs for real on the fake IndexedDB imported above.
vi.spyOn(chatRequestGateway, 'subscribeToIncomingRequestsV2').mockReturnValue(() => {});
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the manager reads only these fields of the double
vi.spyOn(chatRequestGateway, 'sendChatRequestV2').mockResolvedValue(undefined as never);
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the manager reads only these fields of the double
vi.spyOn(peerGateway, 'createPeerResolver').mockReturnValue({
  searchUsers: vi.fn().mockResolvedValue([]),
  getUsername: vi.fn().mockResolvedValue(undefined),
  getPeerContact: vi.fn().mockResolvedValue(null),
  getPeerChatKey: vi.fn().mockResolvedValue(new Uint8Array(32).fill(0xcc)),
} as never);
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the manager reads only these fields of the double
vi.spyOn(pushNotificationGateway, 'sendPushNotification').mockResolvedValue(undefined as never);
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the manager reads only these fields of the double
vi.spyOn(environmentUseCase, 'getActive').mockResolvedValue({ bulletinHopEndpoints: [''] } as never);
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the manager reads only these fields of the double
vi.spyOn(environmentUseCase, 'getActiveId').mockReturnValue('test-env' as never);
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the manager reads only these fields of the double
vi.spyOn(environmentUseCase, 'getById').mockResolvedValue({ backendUrl: 'https://example.invalid' } as never);

const { createP2PChatManagerV2 } = await import('./managerV2Factory');

const key = (fill: number) => new Uint8Array(32).fill(fill);

const buildManager = () =>
  createP2PChatManagerV2({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- test double for the SDK adapter; only the mocked session touches it
    statementStore: {} as any,
    userId: OWN_USER_ID,
    device: {
      statementAccountPublicKey: key(0x11),
      statementAccountSeed: new Uint8Array(64).fill(0x22),
      encryptionPrivateKey: key(0x33),
      encryptionPublicKey: key(0x44),
    },
    userIdentity: {
      identitySr25519PublicKey: key(0x55),
      identityChatPrivateKey: key(0x66),
      identityChatPublicKey: key(0x67),
      rootSr25519PublicKey: null,
      peerDeviceEncPubKey: key(0x68),
      peerDeviceStatementAccountId: key(0x69),
      ssoEncPubKey: null,
    },
  });

const seedRoom = async () => {
  await p2pChatDatabase.rooms.put({
    sessionId: PEER_ID,
    peerId: PEER_ID,
    peerUsername: 'peer',
    userId: OWN_USER_ID,
    createdAt: 1,
    isBlocked: false,
    lastUpdate: 1,
  });
  await contactRepository.upsert({
    accountId: PEER_ID,
    identityChatPublicKey: `0x${'88'.repeat(32)}`,
    devices: [{ statementAccountId: `0x${'99'.repeat(32)}`, encryptionPublicKey: `0x${'aa'.repeat(32)}` }],
  });
};

type OutgoingState = 'new' | 'sent' | 'delivered';

const seedOutgoing = (messageId: string, timestamp: number, state: OutgoingState) => {
  const message: ChatMessage = {
    messageId,
    sessionId: PEER_ID,
    peer: { type: 'p2p', accountId: PEER_ID, name: 'peer' },
    timestamp,
    content: { type: 'text', text: messageId },
    status: { direction: 'outgoing', state },
  };

  return p2pChatDatabase.messages.put(message);
};

const seedIncoming = (messageId: string, timestamp: number, content: MessageContent = { type: 'text', text: messageId }) => {
  const message: ChatMessage = {
    messageId,
    sessionId: PEER_ID,
    peer: { type: 'p2p', accountId: PEER_ID, name: 'peer' },
    timestamp,
    content,
    status: { direction: 'incoming', state: 'seen' },
  };

  return p2pChatDatabase.messages.put(message);
};

const position = (timestamp: number, messageId: string): MessagePosition => ({ timestamp, messageId });

let receiptCount = 0;
const deliverSeenReceipt = (messageId: string, timestamp: bigint) => {
  receiptCount += 1;
  capturedOnMessage?.({
    messageId: `receipt-${receiptCount}`,
    timestamp: 1,
    content: { tag: 'seen', value: { messageId, timestamp } },
  });
};

const readPeerSeen = async () => (await p2pChatDatabase.rooms.get(PEER_ID))?.peerSeen;
const readLastSentSeen = async () => (await p2pChatDatabase.rooms.get(PEER_ID))?.lastSentSeen;

// Records the `peerSeen` of every room update. Dexie diffs a nested object into dotted key paths
// (`peerSeen.timestamp`) once the field exists, so the hook reads the updated row, not the diff.
function createPeerSeenRecorder() {
  const writes: Nullable<MessagePosition>[] = [];
  function record(this: UpdatingHookContext<P2PRoom, string>, modifications: object) {
    const touchesPeerSeen = Object.keys(modifications).some(path => path === 'peerSeen' || path.startsWith('peerSeen.'));
    if (touchesPeerSeen) this.onsuccess = room => writes.push(room.peerSeen);
  }

  return { writes, record };
}

describe('managerV2Factory seen receipts', () => {
  beforeEach(async () => {
    await p2pChatDatabase.rooms.clear();
    await p2pChatDatabase.messages.clear();
    await p2pChatDatabase.requests.clear();
    await contactRepository.clearAll();
    capturedOnMessage = null;
    sendSeenSpy.mockReset();
  });

  describe('incoming seen receipt', () => {
    let manager: Awaited<ReturnType<typeof buildManager>>;

    afterEach(() => {
      manager.dispose();
    });

    it('moves peerSeen to the outgoing message it names and stores no message', async () => {
      await seedRoom();
      await seedOutgoing('o-1', 100, 'delivered');
      manager = await buildManager();
      await manager.initialize();

      deliverSeenReceipt('o-1', 100n);

      await vi.waitFor(async () => {
        expect(await readPeerSeen()).toEqual(position(100, 'o-1'));
      });
      expect(await p2pChatDatabase.messages.toCollection().primaryKeys()).toEqual(['o-1']);
    });

    it('falls back to the newest sent or delivered message at or before the receipt timestamp', async () => {
      await seedRoom();
      await seedOutgoing('o-1', 100, 'sent');
      await seedOutgoing('o-2', 150, 'new');
      await seedOutgoing('o-3', 300, 'delivered');
      manager = await buildManager();
      await manager.initialize();

      deliverSeenReceipt('unknown', 200n);

      await vi.waitFor(async () => {
        expect(await readPeerSeen()).toEqual(position(100, 'o-1'));
      });
    });

    it('never moves peerSeen back', async () => {
      await seedRoom();
      await seedOutgoing('o-1', 100, 'sent');
      await seedOutgoing('o-3', 300, 'delivered');
      manager = await buildManager();
      await manager.initialize();

      const { writes, record } = createPeerSeenRecorder();
      const resolvePeerSeen = vi.spyOn(p2pService, 'resolvePeerSeen');
      p2pChatDatabase.rooms.hook('updating', record);
      try {
        deliverSeenReceipt('o-3', 300n);
        await vi.waitFor(async () => {
          expect(await readPeerSeen()).toEqual(position(300, 'o-3'));
        });

        deliverSeenReceipt('unknown', 150n);
        await vi.waitFor(() => {
          expect(resolvePeerSeen).toHaveReturnedWith(position(100, 'o-1'));
        });

        await seedOutgoing('o-4', 400, 'delivered');
        deliverSeenReceipt('o-4', 400n);
        await vi.waitFor(async () => {
          expect(await readPeerSeen()).toEqual(position(400, 'o-4'));
        });

        expect(writes).toEqual([position(300, 'o-3'), position(400, 'o-4')]);
      } finally {
        p2pChatDatabase.rooms.hook('updating').unsubscribe(record);
        resolvePeerSeen.mockRestore();
      }
    });

    it('ignores a receipt that resolves to nothing', async () => {
      await seedRoom();
      manager = await buildManager();
      await manager.initialize();

      const { writes, record } = createPeerSeenRecorder();
      const resolvePeerSeen = vi.spyOn(p2pService, 'resolvePeerSeen');
      p2pChatDatabase.rooms.hook('updating', record);
      try {
        deliverSeenReceipt('unknown', 50n);
        await vi.waitFor(() => {
          expect(resolvePeerSeen).toHaveReturnedWith(null);
        });

        await seedOutgoing('o-1', 100, 'sent');
        deliverSeenReceipt('o-1', 100n);
        await vi.waitFor(async () => {
          expect(await readPeerSeen()).toEqual(position(100, 'o-1'));
        });

        expect(writes).toEqual([position(100, 'o-1')]);
      } finally {
        p2pChatDatabase.rooms.hook('updating').unsubscribe(record);
        resolvePeerSeen.mockRestore();
      }
    });

    it('logs and drops a receipt it cannot apply', async () => {
      await seedRoom();
      await seedOutgoing('o-1', 100, 'delivered');
      manager = await buildManager();
      await manager.initialize();

      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const where = vi.spyOn(p2pChatDatabase.messages, 'where').mockImplementationOnce(() => {
        throw new Error('messages unavailable');
      });
      try {
        deliverSeenReceipt('o-1', 100n);

        await vi.waitFor(() => {
          expect(warn.mock.calls.some(args => args.includes(PEER_ID))).toBe(true);
        });
        expect(await readPeerSeen()).toBeUndefined();
      } finally {
        where.mockRestore();
        warn.mockRestore();
      }
    });
  });

  describe('sending seen receipts', () => {
    const I_1 = { messageId: 'i-1', timestamp: 100 };
    const I_2 = { messageId: 'i-2', timestamp: 200 };
    let manager: Awaited<ReturnType<typeof buildManager>>;

    beforeEach(async () => {
      // RxJS's `asyncScheduler` runs on `setInterval`; `fake-indexeddb` needs the real `setTimeout`.
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      await seedRoom();
      await seedIncoming('i-1', 100);
      sendSeenSpy.mockResolvedValue('delivered');
      manager = await buildManager();
      await manager.initialize();
    });

    afterEach(() => {
      manager.dispose();
      vi.useRealTimers();
    });

    const passWindow = () => vi.advanceTimersByTime(1000);

    it('sends one receipt naming the last seen message', async () => {
      await seedIncoming('r-1', 200, { type: 'reacted', messageId: 'i-1', emoji: '+1' });

      await manager.markAsRead(PEER_ID);

      await vi.waitFor(() => {
        expect(sendSeenSpy).toHaveBeenCalledTimes(1);
      });
      expect(sendSeenSpy).toHaveBeenCalledWith(I_1);
    });

    it('records a delivered receipt and then sends nothing for the same read', async () => {
      await manager.markAsRead(PEER_ID);
      await vi.waitFor(async () => {
        expect(await readLastSentSeen()).toEqual(position(100, 'i-1'));
      });

      const findLastSeenMessage = vi.spyOn(p2pService, 'findLastSeenMessage');
      try {
        passWindow();
        await manager.markAsRead(PEER_ID);
        // The send has read the messages once it picks one, so the seed below cannot reach it.
        await vi.waitFor(() => {
          expect(findLastSeenMessage).toHaveBeenCalledTimes(1);
        });

        await seedIncoming('i-2', 200);
        passWindow();
        await manager.markAsRead(PEER_ID);
        await vi.waitFor(() => {
          expect(sendSeenSpy).toHaveBeenLastCalledWith(I_2);
        });
      } finally {
        findLastSeenMessage.mockRestore();
      }

      expect(sendSeenSpy.mock.calls).toEqual([[I_1], [I_2]]);
    });

    it('records nothing for a failed receipt, so the next read sends again', async () => {
      sendSeenSpy.mockResolvedValue('failed');

      await manager.markAsRead(PEER_ID);
      await vi.waitFor(() => {
        expect(sendSeenSpy).toHaveBeenCalledTimes(1);
      });
      passWindow();
      await manager.markAsRead(PEER_ID);
      await vi.waitFor(() => {
        expect(sendSeenSpy).toHaveBeenCalledTimes(2);
      });

      expect(sendSeenSpy.mock.calls).toEqual([[I_1], [I_1]]);
      expect(await readLastSentSeen()).toBeUndefined();
    });

    it('records nothing for a replaced receipt', async () => {
      sendSeenSpy.mockResolvedValue('replaced');

      await manager.markAsRead(PEER_ID);
      await vi.waitFor(() => {
        expect(sendSeenSpy).toHaveBeenCalledTimes(1);
      });
      passWindow();
      await manager.markAsRead(PEER_ID);
      await vi.waitFor(() => {
        expect(sendSeenSpy).toHaveBeenCalledTimes(2);
      });

      expect(sendSeenSpy.mock.calls).toEqual([[I_1], [I_1]]);
      expect(await readLastSentSeen()).toBeUndefined();
    });

    it('sends nothing while a request with the peer is pending', async () => {
      await p2pChatDatabase.requests.put({
        requestId: 'req-1',
        peerId: PEER_ID,
        direction: 'incoming',
        status: 'pending',
        timestamp: 1,
        userId: OWN_USER_ID,
        lastUpdate: 1,
      });

      const where = vi.spyOn(p2pChatDatabase.requests, 'where');
      try {
        await manager.markAsRead(PEER_ID);
        // IndexedDB runs a write after every read opened before it, so once the send has opened
        // its request read, the update below cannot change what that read sees.
        await vi.waitFor(() => {
          expect(where).toHaveBeenCalledWith('peerId');
        });
      } finally {
        where.mockRestore();
      }

      // The control names a newer message, so a receipt the gate let through stays a separate call
      // instead of being deduplicated against `lastSentSeen`.
      await p2pChatDatabase.requests.update('req-1', { status: 'accepted' });
      await seedIncoming('i-2', 200);
      passWindow();
      await manager.markAsRead(PEER_ID);
      await vi.waitFor(() => {
        expect(sendSeenSpy).toHaveBeenCalledTimes(1);
      });

      expect(sendSeenSpy.mock.calls).toEqual([[I_2]]);
    });

    it('sends nothing to a blocked peer', async () => {
      await manager.setBlocked(PEER_ID, true);
      await manager.markAsRead(PEER_ID);

      await manager.setBlocked(PEER_ID, false);
      await seedIncoming('i-2', 200);
      passWindow();
      await manager.markAsRead(PEER_ID);
      await vi.waitFor(() => {
        expect(sendSeenSpy).toHaveBeenCalledTimes(1);
      });

      expect(sendSeenSpy.mock.calls).toEqual([[I_2]]);
    });

    it('sends nothing to a peer whose room is blocked while the session is up', async () => {
      await p2pChatDatabase.rooms.update(PEER_ID, { isBlocked: true });

      const where = vi.spyOn(p2pChatDatabase.rooms, 'where');
      try {
        await manager.markAsRead(PEER_ID);
        // The send opens its room read before anything else, so the update below cannot change what it sees.
        await vi.waitFor(() => {
          expect(where).toHaveBeenCalledWith('peerId');
        });
      } finally {
        where.mockRestore();
      }

      // The control names a newer message, so a receipt the gate let through stays a separate call
      // instead of being deduplicated against `lastSentSeen`.
      await p2pChatDatabase.rooms.update(PEER_ID, { isBlocked: false });
      await seedIncoming('i-2', 200);
      passWindow();
      await manager.markAsRead(PEER_ID);
      await vi.waitFor(() => {
        expect(sendSeenSpy).toHaveBeenCalledTimes(1);
      });

      expect(sendSeenSpy.mock.calls).toEqual([[I_2]]);
    });

    it('logs and skips a send whose reads fail', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const where = vi.spyOn(p2pChatDatabase.requests, 'where').mockImplementationOnce(() => {
        throw new Error('requests unavailable');
      });
      try {
        await manager.markAsRead(PEER_ID);
        await vi.waitFor(() => {
          expect(warn.mock.calls.some(args => args.includes(PEER_ID))).toBe(true);
        });
        expect(sendSeenSpy).not.toHaveBeenCalled();

        passWindow();
        await manager.markAsRead(PEER_ID);
        await vi.waitFor(() => {
          expect(sendSeenSpy).toHaveBeenCalledTimes(1);
        });
      } finally {
        where.mockRestore();
        warn.mockRestore();
      }

      expect(sendSeenSpy.mock.calls).toEqual([[I_1]]);
    });

    it('sends at once, holds a burst, and sends once more when the window ends', async () => {
      await manager.markAsRead(PEER_ID);
      await vi.waitFor(() => {
        expect(sendSeenSpy).toHaveBeenCalledTimes(1);
      });
      expect(sendSeenSpy).toHaveBeenLastCalledWith(I_1);

      await seedIncoming('i-2', 200);
      await manager.markAsRead(PEER_ID);
      await manager.markAsRead(PEER_ID);
      vi.advanceTimersByTime(1000);
      await vi.waitFor(() => {
        expect(sendSeenSpy).toHaveBeenCalledTimes(2);
      });

      expect(sendSeenSpy.mock.calls[1]).toEqual([I_2]);
    });

    it('stops the window on dispose', async () => {
      await manager.markAsRead(PEER_ID);
      await vi.waitFor(() => {
        expect(sendSeenSpy).toHaveBeenCalledTimes(1);
      });
      await manager.markAsRead(PEER_ID);
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      manager.dispose();
      expect(vi.getTimerCount()).toBe(0);

      await manager.markAsRead(PEER_ID);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('stops the window when the peer is blocked', async () => {
      await manager.markAsRead(PEER_ID);
      await vi.waitFor(() => {
        expect(sendSeenSpy).toHaveBeenCalledTimes(1);
      });
      await manager.markAsRead(PEER_ID);
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      await manager.setBlocked(PEER_ID, true);
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
