import 'fake-indexeddb/auto';

import { AccountId as AccountIdCodec } from '@polkadot-api/substrate-bindings';
import Dexie from 'dexie';
import { fromHex, toHex } from 'polkadot-api/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { environmentUseCase } from '@/domains/application';
import { contactRepository, contactWriteUseCase } from '@/domains/contact';
import { type ChatMessage } from '../session/types';

import { pushNotificationGateway } from './notifications/gateway';
import { peerGateway } from './peer/gateway';
import { p2pChatDatabase } from './repository';
import {
  type IncomingRequestHandlers,
  type ValidatedRequest,
  type ValidatedRequestCancel,
  type ValidatedRequestV2,
  chatRequestGateway,
} from './requests/gateway';
import { chatRequestService } from './requests/service';
import { p2pService } from './service';
import { type P2PChatRequest } from './types';

const OWN_USER_ID = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const PEER_ID = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';

const key = (fill: number) => new Uint8Array(32).fill(fill);

// `createP2PChatManagerV2` takes no session factory as a parameter, so replacing the module is the only seam.
vi.mock('./chatSessionV2', () => ({
  createChatPeerSessionV2: () => ({ send: vi.fn().mockResolvedValue({ messageId: 'm', timestamp: 1 }), dispose: vi.fn() }),
  isMessageTooLargeError: () => false,
}));

// `createP2PChatManagerV2` takes no identity-channel factory as a parameter, so replacing the module is the only seam.
vi.mock('./identityChannel', () => ({
  createIdentityChannel: () => ({ post: vi.fn().mockResolvedValue(undefined), dispose: vi.fn() }),
}));

// `createP2PChatManagerV2` takes no subscription factory as a parameter, and `trackedSubscribeStatements` is a bare
// function export that nothing can spy on in place, so replacing the module is the only seam.
vi.mock('./subscription-registry', () => ({
  trackedSubscribeStatements: vi.fn().mockReturnValue(() => {}),
}));

let handlers: IncomingRequestHandlers | null = null;
vi.spyOn(chatRequestGateway, 'subscribeToIncomingRequestsV2').mockImplementation((_params, incoming) => {
  handlers = incoming;
  return () => {};
});
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the manager reads only these fields of the double
vi.spyOn(chatRequestGateway, 'sendChatRequestV2').mockResolvedValue(undefined as never);

const getPeerChatKey = vi.fn<(peerId: string) => Promise<Uint8Array | null>>();
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the manager reads only these fields of the double
vi.spyOn(peerGateway, 'createPeerResolver').mockReturnValue({
  searchUsers: vi.fn().mockResolvedValue([]),
  getUsername: vi.fn().mockResolvedValue(undefined),
  getPeerContact: vi.fn().mockResolvedValue(null),
  getPeerChatKey,
} as never);
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the manager reads only these fields of the double
vi.spyOn(pushNotificationGateway, 'sendPushNotification').mockResolvedValue(undefined as never);
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the manager reads only these fields of the double
vi.spyOn(environmentUseCase, 'getActive').mockResolvedValue({ bulletinHopEndpoints: [''] } as never);
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the manager reads only these fields of the double
vi.spyOn(environmentUseCase, 'getActiveId').mockReturnValue('test-env' as never);
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the manager reads only these fields of the double
vi.spyOn(environmentUseCase, 'getById').mockResolvedValue({ backendUrl: 'https://example.invalid' } as never);

const sendCancel = vi.spyOn(chatRequestGateway, 'sendChatRequestCancel');
const deleteContactWithoutSync = vi.spyOn(contactWriteUseCase, 'deleteContactWithoutSync');
const deleteContact = vi.spyOn(contactWriteUseCase, 'deleteContact');
const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});

const { createP2PChatManagerV2 } = await import('./managerV2Factory');

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

const startManager = async () => {
  const manager = await buildManager();
  await manager.initialize();
  if (!handlers) throw new Error('the manager did not subscribe to incoming requests');

  return { manager, incoming: handlers };
};

const cancelFromPeer = (requestId: string, timestamp: number, proofRequestId = requestId): ValidatedRequestCancel => {
  const identityAccountId = AccountIdCodec().enc(PEER_ID);
  const sharedSecret = p2pService.computeSharedSecret(key(0x66), key(0xcc));

  return {
    requestId,
    timestamp,
    senderIdentityAccountId: identityAccountId,
    identityProof: chatRequestService.computeCancelProof(sharedSecret, identityAccountId, proofRequestId),
  };
};

const requestFromPeer = (requestId: string, timestamp: number): ValidatedRequest => ({
  requestId,
  senderAccountId: AccountIdCodec().enc(PEER_ID),
  welcomeMessage: 'hello',
  timestamp,
});

const PEER_DEVICE = key(0xd1);

const v2RequestFromPeer = (requestId: string, provenDevice = PEER_DEVICE): ValidatedRequestV2 => {
  const identityAccountId = AccountIdCodec().enc(PEER_ID);
  const sharedSecret = p2pService.computeSharedSecret(key(0x66), key(0xcc));

  return {
    ...requestFromPeer(requestId, 10),
    senderIdentityAccountId: identityAccountId,
    senderIdentityProof: chatRequestService.computeIdentityProof(sharedSecret, identityAccountId, provenDevice),
    senderDevicePubKey: key(0xd2),
    senderDeviceStatementAccountId: PEER_DEVICE,
  };
};

const incomingRow = (requestId: string, status: P2PChatRequest['status']): P2PChatRequest => ({
  requestId,
  peerId: PEER_ID,
  peerUsername: 'peer',
  direction: 'incoming',
  status,
  welcomeMessage: 'hello',
  timestamp: 10,
  userId: OWN_USER_ID,
  lastUpdate: 10,
});

const peerMessage = (messageId: string, content: ChatMessage['content']): ChatMessage => ({
  messageId,
  sessionId: PEER_ID,
  peer: { type: 'p2p', accountId: PEER_ID, name: 'peer' },
  timestamp: 10,
  content,
  status: { direction: 'incoming', state: 'seen' },
});

const seedAcceptedChat = async (requestId: string, conversation: ChatMessage[] = []) => {
  await p2pChatDatabase.requests.put(incomingRow(requestId, 'accepted'));
  await p2pChatDatabase.rooms.put({
    sessionId: PEER_ID,
    peerId: PEER_ID,
    peerUsername: 'peer',
    userId: OWN_USER_ID,
    createdAt: 10,
    lastUpdate: 10,
  });
  await p2pChatDatabase.messages.bulkPut([
    peerMessage(`req-accepted:${requestId}`, { type: 'contactAdded' }),
    peerMessage(requestId, { type: 'text', text: 'hello' }),
    ...conversation,
  ]);
  await contactRepository.upsert({
    accountId: PEER_ID,
    identityChatPublicKey: `0x${'cc'.repeat(32)}`,
    devices: [],
  });
};

const peerMessageCount = () => p2pChatDatabase.messages.where('sessionId').equals(PEER_ID).count();

const waitForDebug = (fragment: string, requestId: string) =>
  vi.waitFor(() => {
    const logged = debug.mock.calls.some(([format, ...args]) => String(format).includes(fragment) && args.includes(requestId));
    expect(logged).toBe(true);
  });

const waitForWarning = (fragment: string, requestId: string) =>
  vi.waitFor(() => {
    const warned = warn.mock.calls.some(([format, ...args]) => String(format).includes(fragment) && args.includes(requestId));
    expect(warned).toBe(true);
  });

beforeEach(async () => {
  await p2pChatDatabase.rooms.clear();
  await p2pChatDatabase.messages.clear();
  await p2pChatDatabase.requests.clear();
  await contactRepository.clearAll();
  handlers = null;
  getPeerChatKey.mockReset();
  getPeerChatKey.mockResolvedValue(key(0xcc));
  sendCancel.mockReset();
  sendCancel.mockResolvedValue('published');
  deleteContactWithoutSync.mockClear();
  deleteContact.mockClear();
  warn.mockClear();
  debug.mockClear();
});

describe('managerV2Factory incoming chat request cancel', () => {
  it('tombstones an unknown id and drops the later copy', async () => {
    const { incoming } = await startManager();

    incoming.onCancel(cancelFromPeer('req-early', 20));
    await vi.waitFor(async () => {
      const row = await p2pChatDatabase.requests.get('req-early');
      expect(row).toMatchObject({ direction: 'incoming', status: 'cancelled', peerId: PEER_ID, timestamp: 20 });
    });

    const addCopy = vi.spyOn(p2pChatDatabase.requests.db, 'transaction');
    incoming.onRequest(requestFromPeer('req-early', 10));
    await vi.waitFor(() => expect(addCopy).toHaveBeenCalled());
    await addCopy.mock.results[0]?.value;
    addCopy.mockRestore();

    const row = await p2pChatDatabase.requests.get('req-early');
    expect(row?.status).toBe('cancelled');
    expect(row?.welcomeMessage).toBeUndefined();
  });

  it('keeps the cancel that lands while its copy is being added', async () => {
    const { incoming } = await startManager();
    const readRooms = p2pChatDatabase.rooms.where.bind(p2pChatDatabase.rooms);
    // The copy reads the block flag between its existing-row check and its write, so the
    // cancel delivered here lands between the two. `ignoreTransaction` keeps the cancel out
    // of the copy's transaction zone, as a cancel off the wire would be.
    const roomRead = vi.spyOn(p2pChatDatabase.rooms, 'where').mockImplementationOnce(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the copy calls only the index overload of `where`
      ((index: string) => {
        Dexie.ignoreTransaction(() => incoming.onCancel(cancelFromPeer('req-race', 20)));
        return readRooms(index);
      }) as never,
    );

    incoming.onRequest(requestFromPeer('req-race', 10));

    await vi.waitFor(async () => {
      expect(await p2pChatDatabase.requests.get('req-race')).toMatchObject({ status: 'cancelled', welcomeMessage: 'hello' });
    });
    roomRead.mockRestore();
  });

  it('cancels a pending request delivered before it', async () => {
    const { incoming } = await startManager();

    incoming.onRequest(requestFromPeer('req-pending', 10));
    await vi.waitFor(async () => {
      expect((await p2pChatDatabase.requests.get('req-pending'))?.status).toBe('pending');
    });

    incoming.onCancel(cancelFromPeer('req-pending', 20));

    await vi.waitFor(async () => {
      expect((await p2pChatDatabase.requests.get('req-pending'))?.status).toBe('cancelled');
    });
  });

  it('removes an accepted chat that holds only the request rows', async () => {
    await seedAcceptedChat('req-accepted');
    const { incoming } = await startManager();

    incoming.onCancel(cancelFromPeer('req-accepted', 20));

    await vi.waitFor(() => expect(deleteContactWithoutSync).toHaveBeenCalledWith(PEER_ID));
    expect((await p2pChatDatabase.requests.get('req-accepted'))?.status).toBe('cancelled');
    expect(await p2pChatDatabase.rooms.get(PEER_ID)).toBeUndefined();
    expect(await peerMessageCount()).toBe(0);
    expect(deleteContact).not.toHaveBeenCalled();
  });

  it('keeps an accepted chat with a conversation', async () => {
    await seedAcceptedChat('req-talked', [peerMessage('msg-1', { type: 'text', text: 'how are you' })]);
    const { incoming } = await startManager();

    incoming.onCancel(cancelFromPeer('req-talked', 20));

    await waitForDebug('nothing to cancel', 'req-talked');
    expect((await p2pChatDatabase.requests.get('req-talked'))?.status).toBe('accepted');
    expect(await p2pChatDatabase.rooms.get(PEER_ID)).toBeDefined();
    expect(await peerMessageCount()).toBe(3);
    expect(deleteContactWithoutSync).not.toHaveBeenCalled();
  });

  it('ignores a cancel whose proof does not match', async () => {
    const { incoming } = await startManager();

    incoming.onCancel(cancelFromPeer('req-forged', 20, 'another-request'));

    await waitForWarning('proof', 'req-forged');
    expect(await p2pChatDatabase.requests.get('req-forged')).toBeUndefined();
  });

  it('ignores a cancel when the sender has no chat key', async () => {
    getPeerChatKey.mockResolvedValueOnce(null);
    const { incoming } = await startManager();

    incoming.onCancel(cancelFromPeer('req-no-key', 20));

    await waitForWarning('chat key', 'req-no-key');
    expect(await p2pChatDatabase.requests.get('req-no-key')).toBeUndefined();
  });

  it('leaves the rows as they were when the transaction fails', async () => {
    await seedAcceptedChat('req-tx');
    const deleteRoom = vi.spyOn(p2pChatDatabase.rooms, 'delete').mockRejectedValueOnce(new Error('disk full'));
    const { incoming } = await startManager();

    incoming.onCancel(cancelFromPeer('req-tx', 20));

    await vi.waitFor(() => {
      expect(
        warn.mock.calls.some(
          args => args.includes('req-tx') && args.some(arg => arg instanceof Error && arg.message === 'disk full'),
        ),
      ).toBe(true);
    });
    expect(deleteRoom).toHaveBeenCalledWith(PEER_ID);
    deleteRoom.mockRestore();
    expect((await p2pChatDatabase.requests.get('req-tx'))?.status).toBe('accepted');
    expect(await p2pChatDatabase.rooms.get(PEER_ID)).toBeDefined();
    expect(await peerMessageCount()).toBe(2);
    expect(deleteContactWithoutSync).not.toHaveBeenCalled();
  });

  it('keeps the cancel when the contact delete fails', async () => {
    await seedAcceptedChat('req-contact');
    deleteContactWithoutSync.mockRejectedValueOnce(new Error('contact store'));
    const { incoming } = await startManager();

    expect(() => incoming.onCancel(cancelFromPeer('req-contact', 20))).not.toThrow();

    await waitForWarning('cleanup', 'req-contact');
    expect((await p2pChatDatabase.requests.get('req-contact'))?.status).toBe('cancelled');
    expect(await p2pChatDatabase.rooms.get(PEER_ID)).toBeUndefined();
  });

  it('removes the chat an in-flight accept made', async () => {
    await p2pChatDatabase.requests.put({
      ...incomingRow('req-racing', 'pending'),
      senderDevicePubKey: `0x${'88'.repeat(32)}`,
      senderDeviceStatementAccountId: `0x${'99'.repeat(32)}`,
    });
    const { manager, incoming } = await startManager();
    let resolveChatKey: (chatKey: Uint8Array | null) => void = () => {};
    getPeerChatKey.mockReturnValueOnce(
      new Promise(resolve => {
        resolveChatKey = resolve;
      }),
    );

    const accepting = manager.acceptRequest('req-racing');
    await vi.waitFor(() => expect(getPeerChatKey).toHaveBeenCalledTimes(1));
    incoming.onCancel(cancelFromPeer('req-racing', 20));
    resolveChatKey(key(0xcc));
    await accepting;

    await vi.waitFor(() => expect(deleteContactWithoutSync).toHaveBeenCalledWith(PEER_ID));
    expect(await p2pChatDatabase.rooms.get(PEER_ID)).toBeUndefined();
    expect((await p2pChatDatabase.requests.get('req-racing'))?.status).toBe('cancelled');
  });

  it('does not accept a cancelled request', async () => {
    await p2pChatDatabase.requests.put(incomingRow('req-gone', 'cancelled'));
    const { manager } = await startManager();

    await manager.acceptRequest('req-gone');

    expect(await p2pChatDatabase.rooms.get(PEER_ID)).toBeUndefined();
    expect((await p2pChatDatabase.requests.get('req-gone'))?.status).toBe('cancelled');
  });
});

describe('managerV2Factory incoming chat request verification', () => {
  it('stores a v2 request whose identity proof matches', async () => {
    const { incoming } = await startManager();

    incoming.onRequest(v2RequestFromPeer('req-v2'));

    await vi.waitFor(async () => {
      expect(await p2pChatDatabase.requests.get('req-v2')).toMatchObject({
        status: 'pending',
        peerId: PEER_ID,
        senderDeviceStatementAccountId: toHex(PEER_DEVICE),
      });
    });
    expect(getPeerChatKey).toHaveBeenCalledWith(PEER_ID);
  });

  it('drops a v2 request whose identity proof binds another device', async () => {
    const { incoming } = await startManager();

    incoming.onRequest(v2RequestFromPeer('req-forged', key(0xd9)));

    await waitForWarning('identity proof does not match', 'req-forged');
    expect(await p2pChatDatabase.requests.get('req-forged')).toBeUndefined();

    incoming.onRequest(v2RequestFromPeer('req-forged', key(0xd9)));
    expect(getPeerChatKey).toHaveBeenCalledTimes(1);
  });

  it('drops a v2 request whose sender has no chat key, and checks a later delivery again', async () => {
    getPeerChatKey.mockResolvedValueOnce(null);
    const { incoming } = await startManager();

    incoming.onRequest(v2RequestFromPeer('req-retry'));
    await waitForWarning('sender has no chat key', 'req-retry');
    expect(await p2pChatDatabase.requests.get('req-retry')).toBeUndefined();

    incoming.onRequest(v2RequestFromPeer('req-retry'));

    await vi.waitFor(async () => {
      expect((await p2pChatDatabase.requests.get('req-retry'))?.status).toBe('pending');
    });
  });

  it('drops a v2 request when the chat key lookup throws', async () => {
    getPeerChatKey.mockRejectedValueOnce(new Error('rpc'));
    const { incoming } = await startManager();

    incoming.onRequest(v2RequestFromPeer('req-throw'));

    await waitForWarning('addIncomingRequest: dropped', 'req-throw');
    expect(await p2pChatDatabase.requests.get('req-throw')).toBeUndefined();

    incoming.onRequest(v2RequestFromPeer('req-throw'));
    expect(getPeerChatKey).toHaveBeenCalledTimes(1);
  });

  it('drops a verified v2 request from a blocked peer', async () => {
    await p2pChatDatabase.rooms.put({
      sessionId: PEER_ID,
      peerId: PEER_ID,
      peerUsername: 'peer',
      userId: OWN_USER_ID,
      createdAt: 10,
      lastUpdate: 10,
      isBlocked: true,
    });
    const { incoming } = await startManager();

    const addRequest = vi.spyOn(p2pChatDatabase.requests.db, 'transaction');
    incoming.onRequest(v2RequestFromPeer('req-blocked'));
    await vi.waitFor(() => expect(addRequest).toHaveBeenCalled());
    await addRequest.mock.results[0]?.value;
    addRequest.mockRestore();

    expect(await p2pChatDatabase.requests.get('req-blocked')).toBeUndefined();
  });

  it('stores a v1 request without a chat key lookup', async () => {
    const { incoming } = await startManager();

    incoming.onRequest(requestFromPeer('req-v1', 10));

    await vi.waitFor(async () => {
      expect((await p2pChatDatabase.requests.get('req-v1'))?.status).toBe('pending');
    });
    expect(getPeerChatKey).not.toHaveBeenCalled();
  });
});

const CHANNEL_TOPIC = `0x${'ab'.repeat(32)}`;

const seedOutgoingRequest = async (requestId: string, status: P2PChatRequest['status']) => {
  await p2pChatDatabase.requests.put({
    requestId,
    peerId: PEER_ID,
    peerUsername: 'peer',
    direction: 'outgoing',
    status,
    timestamp: 10,
    channelTopic: CHANNEL_TOPIC,
    userId: OWN_USER_ID,
    lastUpdate: 10,
  });
  await p2pChatDatabase.rooms.put({
    sessionId: PEER_ID,
    peerId: PEER_ID,
    peerUsername: 'peer',
    userId: OWN_USER_ID,
    createdAt: 10,
    lastUpdate: 10,
  });
  await contactRepository.upsert({
    accountId: PEER_ID,
    identityChatPublicKey: `0x${'cc'.repeat(32)}`,
    devices: [],
  });
};

describe('managerV2Factory outgoing chat request cancel', () => {
  it('marks the outgoing request cancelled and publishes the cancel', async () => {
    await seedOutgoingRequest('req-out', 'pending');
    const { manager } = await startManager();

    await manager.cancelOutgoingRequest('req-out', PEER_ID);

    await vi.waitFor(() =>
      expect(sendCancel).toHaveBeenCalledWith({
        requestId: 'req-out',
        requestTimestamp: 10,
        channelTopic: fromHex(CHANNEL_TOPIC),
        recipientAccountId: AccountIdCodec().enc(PEER_ID),
        recipientChatPubKey: key(0xcc),
        senderIdentityAccountId: key(0x55),
        senderIdentityChatPrivateKey: key(0x66),
        senderDeviceSeed: new Uint8Array(64).fill(0x22),
        statementStore: {},
      }),
    );
    expect((await p2pChatDatabase.requests.get('req-out'))?.status).toBe('cancelled');
    expect(await p2pChatDatabase.rooms.get(PEER_ID)).toBeUndefined();
    expect(deleteContact.mock.invocationCallOrder[0]).toBeLessThan(sendCancel.mock.invocationCallOrder[0] ?? 0);
  });

  it('keeps the local cancel when the publish fails', async () => {
    await seedOutgoingRequest('req-out', 'pending');
    sendCancel.mockRejectedValueOnce(new Error('store unreachable'));
    const { manager } = await startManager();

    await expect(manager.cancelOutgoingRequest('req-out', PEER_ID)).resolves.toBeUndefined();

    await waitForWarning('chat request cancel not published', 'req-out');
    expect((await p2pChatDatabase.requests.get('req-out'))?.status).toBe('cancelled');
  });

  it('cancels and publishes even when the leave-chat cleanup fails', async () => {
    await seedOutgoingRequest('req-out', 'pending');
    deleteContact.mockRejectedValueOnce(new Error('contact store'));
    const { manager } = await startManager();

    await expect(manager.cancelOutgoingRequest('req-out', PEER_ID)).rejects.toThrow('contact store');

    await vi.waitFor(() => expect(sendCancel).toHaveBeenCalledTimes(1));
    expect((await p2pChatDatabase.requests.get('req-out'))?.status).toBe('cancelled');
  });

  it('skips the publish when the request has no channel topic', async () => {
    await seedOutgoingRequest('req-out', 'pending');
    await p2pChatDatabase.requests.update('req-out', { channelTopic: undefined });
    const { manager } = await startManager();

    await manager.cancelOutgoingRequest('req-out', PEER_ID);

    await waitForWarning('chat request cancel not published', 'req-out');
    expect(sendCancel).not.toHaveBeenCalled();
    expect((await p2pChatDatabase.requests.get('req-out'))?.status).toBe('cancelled');
  });

  it('skips the publish when the peer has no chat key', async () => {
    await seedOutgoingRequest('req-out', 'pending');
    const { manager } = await startManager();
    getPeerChatKey.mockResolvedValueOnce(null);

    await manager.cancelOutgoingRequest('req-out', PEER_ID);

    await waitForWarning('chat request cancel not published', 'req-out');
    expect(sendCancel).not.toHaveBeenCalled();
    expect((await p2pChatDatabase.requests.get('req-out'))?.status).toBe('cancelled');
  });

  it('ignores a request that is not outgoing and pending', async () => {
    await seedOutgoingRequest('req-out', 'accepted');
    const { manager } = await startManager();

    await manager.cancelOutgoingRequest('req-out', PEER_ID);

    expect(sendCancel).not.toHaveBeenCalled();
    expect(await p2pChatDatabase.requests.get('req-out')).toMatchObject({ status: 'accepted', lastUpdate: 10 });
    expect(await p2pChatDatabase.rooms.get(PEER_ID)).toBeDefined();
  });
});
