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
const DEVICE_ACCOUNT_ID = `0x${'cd'.repeat(32)}`;
const DEVICE_ENC_PUBKEY = `0x${'ef'.repeat(65)}`;

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

// Verifies the scenario-3 fix end-to-end across the device-sync boundary:
// a peer device learned on one device (the "hub") is persisted as a
// `deviceAdded` chat-message row, collected into a `Messages` sync entity,
// and re-applied on a sibling so it lands in that sibling's contact roster.
// Without the producer + collector mapping, the sibling never learns the peer
// device and silently drops its MultiRequests (Android→iOS symptom).
describe('deviceAdded propagation (producer row → collector → applier)', () => {
  beforeEach(async () => {
    await contactDatabase.contacts.clear();
    await contactDatabase.removedContacts.clear();
    await p2pChatDatabase.messages.clear();
    await p2pChatDatabase.rooms.clear();
  });

  it('collector maps a local deviceAdded row to a wire deviceAdded Messages entity', async () => {
    await seedContactAndRoom();
    await p2pChatDatabase.messages.put({
      messageId: `device-added:${PEER_SS58}:${DEVICE_ACCOUNT_ID}`,
      sessionId: PEER_SS58,
      peer: { type: 'p2p', accountId: PEER_SS58, name: PEER_SS58 },
      timestamp: 1_000,
      content: { type: 'deviceAdded', statementAccountId: DEVICE_ACCOUNT_ID, encryptionPublicKey: DEVICE_ENC_PUBKEY },
      status: { direction: 'incoming', state: 'seen' },
      lastUpdate: 2,
    });

    const { entities } = await collectChangesSince(1);
    const messages = entities.find(e => e.tag === 'Messages');
    if (messages?.tag !== 'Messages') throw new Error('expected a Messages entity');

    const versioned = messages.value[0]!.remote.versioned;
    if (versioned.tag !== 'v1') throw new Error('expected v1');
    expect(versioned.value.tag).toBe('deviceAdded');
    if (versioned.value.tag !== 'deviceAdded') throw new Error('unreachable');
    expect(versioned.value.value.statementAccountId).toEqual(Uint8Array.from(Buffer.from('cd'.repeat(32), 'hex')));
    expect(versioned.value.value.encryptionPublicKey).toEqual(Uint8Array.from(Buffer.from('ef'.repeat(65), 'hex')));
    expect(messages.value[0]!.status.tag).toBe('Incoming');
  });

  it('a sibling applies the synced deviceAdded into Contact(peer).devices', async () => {
    await seedContactAndRoom();
    await p2pChatDatabase.messages.put({
      messageId: `device-added:${PEER_SS58}:${DEVICE_ACCOUNT_ID}`,
      sessionId: PEER_SS58,
      peer: { type: 'p2p', accountId: PEER_SS58, name: PEER_SS58 },
      timestamp: 1_000,
      content: { type: 'deviceAdded', statementAccountId: DEVICE_ACCOUNT_ID, encryptionPublicKey: DEVICE_ENC_PUBKEY },
      status: { direction: 'incoming', state: 'seen' },
      lastUpdate: 2,
    });

    const { entities } = await collectChangesSince(1);
    const messages = entities.find(e => e.tag === 'Messages');
    if (messages?.tag !== 'Messages') throw new Error('expected a Messages entity');

    // Sibling starts with the contact but an empty device roster.
    await contactDatabase.contacts.clear();
    await contactRepository.upsert({ accountId: PEER_SS58, identityChatPublicKey: '0xaa', devices: [] });

    await applySyncEntities([messages], ctx);

    const contact = await contactRepository.get(PEER_SS58);
    const device = contact?.devices.find(d => d.statementAccountId === DEVICE_ACCOUNT_ID);
    expect(device).toBeDefined();
    expect(device?.encryptionPublicKey).toBe(DEVICE_ENC_PUBKEY);
  });
});
