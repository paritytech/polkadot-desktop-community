import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

/* eslint-disable boundaries/dependencies -- direct sub-path imports avoid transitive wasm load (verifiablejs) via @/domains/chat and @/domains/contact roots */
import { p2pChatDatabase } from '@/domains/chat/p2p/repository';
import { contactDatabase, contactRepository } from '@/domains/contact/identity/repository';
/* eslint-enable boundaries/dependencies */

import { type ApplierContext, applySyncEntities } from './applier';
import { collectChangesSince } from './collector';

const PEER_SS58 = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const OWN_USER_ID = '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
const TOKEN_HEX = 'ab'.repeat(32); // stored without 0x, mirroring rooms.peerPushToken

const ctx: ApplierContext = {
  resolveConsumerInfo: vi.fn().mockResolvedValue({ chatKey: new Uint8Array(65).fill(0x9a), username: 'alice' }),
  ownUserId: OWN_USER_ID,
};

const seedContactAndRoom = async () => {
  await contactRepository.upsert({ accountId: PEER_SS58, identityChatPublicKey: '0xaa', devices: [] });
  await p2pChatDatabase.rooms.put({
    sessionId: PEER_SS58,
    peerId: PEER_SS58,
    peerUsername: 'alice',
    peerP256PublicKey: '0xaa',
    userId: OWN_USER_ID,
    createdAt: 1,
    lastUpdate: 1,
  });
};

const seedTokenRow = async () => {
  await p2pChatDatabase.messages.put({
    messageId: `token:${PEER_SS58}`,
    sessionId: PEER_SS58,
    peer: { type: 'p2p', accountId: PEER_SS58, name: PEER_SS58 },
    timestamp: 1_000,
    content: { type: 'token', token: TOKEN_HEX, platform: 'Android' },
    status: { direction: 'incoming', state: 'seen' },
    lastUpdate: 2,
  });
};

// Verifies the peer-push-token sync fix end-to-end across the device-sync
// boundary: a peer token learned on the "hub" device is persisted as a `token`
// chat-message row, collected into a `Messages` sync entity, and re-applied on a
// sibling so it lands in that sibling's `rooms.peerPushToken`. Without the
// producer row + the collector's `mapContentToWire` token case, the token never
// crosses sync and the sibling can't send push notifications (the reported bug).
describe('token propagation (producer row → collector → applier)', () => {
  beforeEach(async () => {
    await contactDatabase.contacts.clear();
    await contactDatabase.removedContacts.clear();
    await p2pChatDatabase.messages.clear();
    await p2pChatDatabase.rooms.clear();
    await p2pChatDatabase.requests.clear();
  });

  it('collector maps a local token row to a wire token Messages entity', async () => {
    await seedContactAndRoom();
    await seedTokenRow();

    const { entities } = await collectChangesSince(1);
    const messages = entities.find(e => e.tag === 'Messages');
    if (messages?.tag !== 'Messages') throw new Error('expected a Messages entity');

    const versioned = messages.value[0]!.remote.versioned;
    if (versioned.tag !== 'v1') throw new Error('expected v1');
    expect(versioned.value.tag).toBe('token');
    if (versioned.value.tag !== 'token') throw new Error('unreachable');
    expect(versioned.value.value.token).toBe(`0x${TOKEN_HEX}`);
    expect(versioned.value.value.platform).toBe('Android');
    expect(messages.value[0]!.status.tag).toBe('Incoming');
  });

  it('a sibling applies the synced token into rooms.peerPushToken', async () => {
    await seedContactAndRoom();
    await seedTokenRow();

    const { entities } = await collectChangesSince(1);
    const messages = entities.find(e => e.tag === 'Messages');
    if (messages?.tag !== 'Messages') throw new Error('expected a Messages entity');

    // Sibling has the room but no token yet.
    await p2pChatDatabase.rooms.where('peerId').equals(PEER_SS58).modify({ peerPushToken: undefined, peerPlatform: undefined });

    await applySyncEntities([messages], ctx);

    const room = await p2pChatDatabase.rooms.where('peerId').equals(PEER_SS58).first();
    expect(room?.peerPushToken).toBe(TOKEN_HEX);
    expect(room?.peerPlatform).toBe('Android');
  });
});
