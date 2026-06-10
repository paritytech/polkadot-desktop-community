import 'fake-indexeddb/auto';

import { type CodecType } from 'scale-ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* eslint-disable boundaries/dependencies -- direct sub-path imports avoid pulling
   wasm-loading transitive deps (rosterSubscriber → attestationService → verifiablejs)
   into the vitest sandbox; same workaround as collector.spec.ts */
import { p2pChatDatabase } from '@/domains/chat/p2p/repository';
import { contactDatabase, contactRepository } from '@/domains/contact/identity/repository';
/* eslint-enable boundaries/dependencies */

import { type ApplierContext, applySyncEntities } from './applier';
import { type SyncEntityCodec } from './codec';
import { encodeAccountIdSs58 } from './ss58';

type SyncEntity = CodecType<typeof SyncEntityCodec>;

const TEST_PEER_SS58 = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const TEST_CHAT_KEY = new Uint8Array(65).fill(0x9a);

const TEST_OWN_USER_ID = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';

const stubCtx = (lookup?: ApplierContext['resolveConsumerInfo']): ApplierContext => ({
  resolveConsumerInfo: lookup ?? vi.fn().mockResolvedValue({ chatKey: TEST_CHAT_KEY, username: 'alice' }),
  ownUserId: TEST_OWN_USER_ID,
});

describe('applySyncEntities', () => {
  beforeEach(async () => {
    await contactDatabase.contacts.clear();
    await contactDatabase.removedContacts.clear();
    await p2pChatDatabase.messages.clear();
    await p2pChatDatabase.rooms.clear();
    await p2pChatDatabase.requests.clear();
  });

  it('upserts contact for ChatsAdded(Contact) using ConsumerInfo lookup', async () => {
    await applySyncEntities(
      [
        {
          tag: 'ChatsAdded',
          value: [{ tag: 'Contact', value: encodeAccountIdSs58(TEST_PEER_SS58) }],
        },
      ],
      stubCtx(),
    );
    const c = await contactRepository.get(TEST_PEER_SS58);
    expect(c).toBeDefined();
    expect(c?.identityChatPublicKey).toMatch(/^0x9a9a/);
  });

  it('materialises a P2PRoom alongside the contact for ChatsAdded(Contact)', async () => {
    await applySyncEntities(
      [
        {
          tag: 'ChatsAdded',
          value: [{ tag: 'Contact', value: encodeAccountIdSs58(TEST_PEER_SS58) }],
        },
      ],
      stubCtx(),
    );
    const room = await p2pChatDatabase.rooms.get(TEST_PEER_SS58);
    expect(room).toBeDefined();
    expect(room?.peerId).toBe(TEST_PEER_SS58);
    expect(room?.userId).toBe(TEST_OWN_USER_ID);
    expect(room?.peerUsername).toBe('alice');
    expect(room?.peerP256PublicKey).toMatch(/^0x9a9a/);
  });

  it('does not overwrite an existing P2PRoom when ChatsAdded re-applies', async () => {
    const original = {
      sessionId: TEST_PEER_SS58,
      peerId: TEST_PEER_SS58,
      peerUsername: 'pre-existing',
      peerP256PublicKey: '0xdead',
      userId: TEST_OWN_USER_ID,
      createdAt: 1,
      lastUpdate: 1,
    };
    await p2pChatDatabase.rooms.put(original);

    await applySyncEntities(
      [
        {
          tag: 'ChatsAdded',
          value: [{ tag: 'Contact', value: encodeAccountIdSs58(TEST_PEER_SS58) }],
        },
      ],
      stubCtx(),
    );

    const room = await p2pChatDatabase.rooms.get(TEST_PEER_SS58);
    expect(room?.peerUsername).toBe('pre-existing');
    expect(room?.peerP256PublicKey).toBe('0xdead');
  });

  it('skips ChatsAdded contact when ConsumerInfo lookup returns null', async () => {
    await applySyncEntities(
      [
        {
          tag: 'ChatsAdded',
          value: [{ tag: 'Contact', value: encodeAccountIdSs58(TEST_PEER_SS58) }],
        },
      ],
      stubCtx(() => Promise.resolve(null)),
    );
    const c = await contactRepository.get(TEST_PEER_SS58);
    expect(c).toBeUndefined();
  });

  it('idempotent — applying the same ChatsAdded twice creates one row and looks up once', async () => {
    const lookup = vi.fn().mockResolvedValue({ chatKey: TEST_CHAT_KEY, username: 'alice' });
    const entity = {
      tag: 'ChatsAdded' as const,
      value: [{ tag: 'Contact' as const, value: encodeAccountIdSs58(TEST_PEER_SS58) }],
    };
    await applySyncEntities([entity], stubCtx(lookup));
    await applySyncEntities([entity], stubCtx(lookup));
    const all = await contactRepository.list();
    expect(all).toHaveLength(1);
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('transfers the peer device key from a pending incoming request into Contact.devices on ChatsAdded auto-accept', async () => {
    // Regression: a sibling accepted the request, so this device learns of it
    // only via the ChatsAdded sync (not its own `acceptRequest`). The device
    // key the peer's request carried must land on the contact, otherwise V2
    // `startSession` aborts at the `devices.length === 0` gate.
    const deviceStmtAcct = '0x' + '11'.repeat(32);
    const devicePubKey = '0x' + '22'.repeat(65);
    await p2pChatDatabase.requests.put({
      requestId: 'req-device-transfer',
      peerId: TEST_PEER_SS58,
      direction: 'incoming',
      status: 'pending',
      timestamp: 1000,
      userId: TEST_OWN_USER_ID,
      senderDevicePubKey: devicePubKey,
      senderDeviceStatementAccountId: deviceStmtAcct,
      lastUpdate: 1000,
    });

    await applySyncEntities(
      [{ tag: 'ChatsAdded', value: [{ tag: 'Contact', value: encodeAccountIdSs58(TEST_PEER_SS58) }] }],
      stubCtx(),
    );

    const c = await contactRepository.get(TEST_PEER_SS58);
    expect(c?.devices).toEqual([{ statementAccountId: deviceStmtAcct, encryptionPublicKey: devicePubKey }]);
    const req = await p2pChatDatabase.requests.get('req-device-transfer');
    expect(req?.status).toBe('accepted');
  });

  it('removes contact and room for ChatsRemoved(Contact) without writing a local tombstone', async () => {
    await contactRepository.upsert({
      accountId: TEST_PEER_SS58,
      identityChatPublicKey: '0xaa',
      devices: [],
    });
    await p2pChatDatabase.rooms.put({
      sessionId: TEST_PEER_SS58,
      peerId: TEST_PEER_SS58,
      peerUsername: 'alice',
      peerP256PublicKey: '0xaa',
      userId: TEST_OWN_USER_ID,
      createdAt: 1,
      lastUpdate: 1,
    });
    await applySyncEntities(
      [
        {
          tag: 'ChatsRemoved',
          value: [{ tag: 'Contact', value: encodeAccountIdSs58(TEST_PEER_SS58) }],
        },
      ],
      stubCtx(),
    );
    const c = await contactRepository.get(TEST_PEER_SS58);
    expect(c).toBeUndefined();
    const room = await p2pChatDatabase.rooms.get(TEST_PEER_SS58);
    expect(room).toBeUndefined();
    // applyRemoteDelete must not echo the deletion back through the collector.
    const tombstones = await contactRepository.listRemovalsSince(0);
    expect(tombstones).toHaveLength(0);
  });

  describe('Messages — outgoing status upgrade from sibling sync', () => {
    const TEST_MESSAGE_ID = 'msg-status-test-1';

    const seedExistingOutgoingMessage = async (state: 'new' | 'sent' | 'delivered') => {
      await p2pChatDatabase.rooms.put({
        sessionId: TEST_PEER_SS58,
        peerId: TEST_PEER_SS58,
        peerUsername: 'alice',
        peerP256PublicKey: '0xaa',
        userId: TEST_OWN_USER_ID,
        createdAt: 1,
        lastUpdate: 1,
      });
      await p2pChatDatabase.messages.put({
        messageId: TEST_MESSAGE_ID,
        sessionId: TEST_PEER_SS58,
        peer: { type: 'p2p', accountId: TEST_OWN_USER_ID, name: '' },
        timestamp: 1_000,
        content: { type: 'text', text: 'Hello from Desktop 7' },
        status: { direction: 'outgoing', state },
        lastUpdate: 1,
      });
    };

    const messagesEntityWithOutgoingStatus = (state: 'NEW' | 'SENT' | 'DELIVERED'): SyncEntity => ({
      tag: 'Messages',
      value: [
        {
          remote: {
            messageId: TEST_MESSAGE_ID,
            timestamp: 1_000n,
            versioned: { tag: 'v1', value: { tag: 'text', value: 'Hello from Desktop 7' } },
          },
          peerId: new Uint8Array(32).fill(0xaa),
          status: { tag: 'Outgoing', value: { tag: state, value: undefined } },
          order: 1_000n,
        },
      ],
    });

    it('upgrades outgoing message status from sent → delivered', async () => {
      await seedExistingOutgoingMessage('sent');

      await applySyncEntities([messagesEntityWithOutgoingStatus('DELIVERED')], stubCtx());

      const updated = await p2pChatDatabase.messages.get(TEST_MESSAGE_ID);
      expect(updated?.status).toEqual({ direction: 'outgoing', state: 'delivered' });
      expect((updated?.lastUpdate ?? 0) > 1).toBe(true);
    });

    it('does not regress outgoing status from delivered → sent', async () => {
      await seedExistingOutgoingMessage('delivered');

      await applySyncEntities([messagesEntityWithOutgoingStatus('SENT')], stubCtx());

      const unchanged = await p2pChatDatabase.messages.get(TEST_MESSAGE_ID);
      expect(unchanged?.status).toEqual({ direction: 'outgoing', state: 'delivered' });
      expect(unchanged?.lastUpdate).toBe(1);
    });

    it('leaves outgoing status untouched when sibling re-sends same state', async () => {
      await seedExistingOutgoingMessage('sent');

      await applySyncEntities([messagesEntityWithOutgoingStatus('SENT')], stubCtx());

      const unchanged = await p2pChatDatabase.messages.get(TEST_MESSAGE_ID);
      expect(unchanged?.status).toEqual({ direction: 'outgoing', state: 'sent' });
      expect(unchanged?.lastUpdate).toBe(1);
    });

    it('does not cross-write incoming status onto an existing outgoing message', async () => {
      await seedExistingOutgoingMessage('sent');

      await applySyncEntities(
        [
          {
            tag: 'Messages',
            value: [
              {
                remote: {
                  messageId: TEST_MESSAGE_ID,
                  timestamp: 1_000n,
                  versioned: { tag: 'v1', value: { tag: 'text', value: 'Hello from Desktop 7' } },
                },
                peerId: new Uint8Array(32).fill(0xaa),
                status: { tag: 'Incoming', value: { tag: 'SEEN', value: undefined } },
                order: 1_000n,
              },
            ],
          },
        ],
        stubCtx(),
      );

      const unchanged = await p2pChatDatabase.messages.get(TEST_MESSAGE_ID);
      expect(unchanged?.status).toEqual({ direction: 'outgoing', state: 'sent' });
    });
  });
});
