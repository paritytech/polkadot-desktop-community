import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

/* eslint-disable boundaries/dependencies -- direct sub-path imports avoid transitive wasm load (verifiablejs) via @/domains/chat and @/domains/contact roots */
import { p2pChatDatabase } from '@/domains/chat/p2p/repository';
import { contactDatabase, contactRepository } from '@/domains/contact/identity/repository';
/* eslint-enable boundaries/dependencies */

import { collectChangesSince } from './collector';

const TEST_PEER_SS58 = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const TEST_PEER_SS58_2 = '5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw';

describe('collectChangesSince', () => {
  beforeEach(async () => {
    await contactDatabase.contacts.clear();
    await contactDatabase.removedContacts.clear();
    await p2pChatDatabase.messages.clear();
    await p2pChatDatabase.rooms.clear();
    await p2pChatDatabase.requests.clear();
  });

  it('returns empty entities when nothing changed', async () => {
    const changes = await collectChangesSince(Date.now() + 1000);
    expect(changes.entities).toEqual([]);
  });

  it('returns ChatsAdded for new contacts after t', async () => {
    await contactDatabase.contacts.put({
      accountId: TEST_PEER_SS58,
      identityChatPublicKey: '0xaa',
      devices: [],
      lastUpdate: 100,
    });
    const changes = await collectChangesSince(50);
    expect(changes.entities.length).toBeGreaterThan(0);
    const chatsAdded = changes.entities.find(e => e.tag === 'ChatsAdded');
    expect(chatsAdded).toBeDefined();
  });

  it('excludes a contact with a pending outgoing chat request from ChatsAdded', async () => {
    await contactDatabase.contacts.put({
      accountId: TEST_PEER_SS58,
      identityChatPublicKey: '0xaa',
      devices: [],
      lastUpdate: 100,
    });
    await p2pChatDatabase.requests.put({
      requestId: 'req-1',
      peerId: TEST_PEER_SS58,
      direction: 'outgoing',
      status: 'pending',
      timestamp: 100,
      userId: 'user-1',
      lastUpdate: 100,
    });

    const changes = await collectChangesSince(50);

    const chatsAdded = changes.entities.find(e => e.tag === 'ChatsAdded');
    expect(chatsAdded).toBeUndefined();
    // Mirrors Android `runSyncRound`: timePoint is captured as wall-clock at the
    // start of the round, not derived from item lastUpdate. After Ack this
    // becomes the new checkpoint and any future mutation (including this
    // contact's acceptance bump) re-includes it on the next pump.
    expect(changes.timePoint).toBeGreaterThanOrEqual(100);
  });

  it('includes a contact once its chat request is accepted', async () => {
    await contactDatabase.contacts.put({
      accountId: TEST_PEER_SS58,
      identityChatPublicKey: '0xaa',
      devices: [],
      lastUpdate: 200,
    });
    await p2pChatDatabase.requests.put({
      requestId: 'req-1',
      peerId: TEST_PEER_SS58,
      direction: 'outgoing',
      status: 'accepted',
      timestamp: 100,
      userId: 'user-1',
      lastUpdate: 200,
    });

    const changes = await collectChangesSince(50);

    const chatsAdded = changes.entities.find(e => e.tag === 'ChatsAdded');
    expect(chatsAdded).toBeDefined();
    expect(chatsAdded?.value).toHaveLength(1);
  });

  it('timePoint is captured as wall-clock at round start (Android runSyncRound parity)', async () => {
    await contactDatabase.contacts.put({
      accountId: TEST_PEER_SS58,
      identityChatPublicKey: '0xaa',
      devices: [],
      lastUpdate: 100,
    });
    await contactDatabase.contacts.put({
      accountId: TEST_PEER_SS58_2,
      identityChatPublicKey: '0xbb',
      devices: [],
      lastUpdate: 500,
    });
    const before = Date.now();
    const changes = await collectChangesSince(0);
    const after = Date.now();
    // timePoint = wall-clock snapshot at start of collect, NOT derived from
    // item lastUpdate. Item lastUpdate values (100, 500) are irrelevant here.
    expect(changes.timePoint).toBeGreaterThanOrEqual(before);
    expect(changes.timePoint).toBeLessThanOrEqual(after);
  });

  it('emits ChatsRemoved for tombstones written after t', async () => {
    await contactRepository.upsert({
      accountId: TEST_PEER_SS58,
      identityChatPublicKey: '0xaa',
      devices: [],
    });
    await contactRepository.delete(TEST_PEER_SS58); // user-side delete writes tombstone
    const changes = await collectChangesSince(0);
    const removed = changes.entities.find(e => e.tag === 'ChatsRemoved');
    expect(removed).toBeDefined();
    expect(removed?.value.length).toBe(1);
  });

  it('re-adding a contact clears the tombstone so deletion is not replicated', async () => {
    await contactRepository.upsert({
      accountId: TEST_PEER_SS58,
      identityChatPublicKey: '0xaa',
      devices: [],
    });
    await contactRepository.delete(TEST_PEER_SS58);
    // Re-add the same contact.
    await contactRepository.upsert({
      accountId: TEST_PEER_SS58,
      identityChatPublicKey: '0xaa',
      devices: [],
    });

    const changes = await collectChangesSince(0);
    const removed = changes.entities.find(e => e.tag === 'ChatsRemoved');
    expect(removed).toBeUndefined();
    // The re-add itself still surfaces as ChatsAdded.
    const added = changes.entities.find(e => e.tag === 'ChatsAdded');
    expect(added).toBeDefined();
  });

  it('wraps each message into a ChatMessageStatement under LocalMessage.remote', async () => {
    const room = {
      sessionId: 's1',
      peerId: TEST_PEER_SS58,
      peerUsername: 'alice',
      peerP256PublicKey: '0xff',
      userId: 'u1',
      createdAt: 1,
      lastUpdate: 1,
    };
    await p2pChatDatabase.rooms.put(room);
    await contactRepository.upsert({ accountId: TEST_PEER_SS58, identityChatPublicKey: '0xaa', devices: [] });
    await p2pChatDatabase.messages.put({
      messageId: 'msg-1',
      sessionId: 's1',
      peer: { type: 'p2p', accountId: TEST_PEER_SS58, name: 'alice' },
      timestamp: 1000,
      content: { type: 'text', text: 'hi' },
      status: { direction: 'outgoing', state: 'sent' },
      lastUpdate: 1000,
    });

    const changes = await collectChangesSince(0);
    const messages = changes.entities.find(e => e.tag === 'Messages');
    expect(messages).toBeDefined();
    if (messages?.tag !== 'Messages') throw new Error('unreachable');
    expect(messages.value).toHaveLength(1);
    const m = messages.value[0]!;
    expect(m.remote.messageId).toBe('msg-1');
    expect(m.remote.timestamp).toBe(1000n);
    expect(m.remote.versioned.tag).toBe('v1');
    expect(m.status.tag).toBe('Outgoing');
    if (m.status.tag !== 'Outgoing') throw new Error('unreachable');
    expect(m.status.value.tag).toBe('SENT');
  });

  it('skips messages whose peer has no contact yet (variant-2 gate: pre-accept welcome)', async () => {
    await p2pChatDatabase.rooms.put({
      sessionId: 's1',
      peerId: TEST_PEER_SS58,
      peerUsername: 'alice',
      peerP256PublicKey: '0xff',
      userId: 'u1',
      createdAt: 1,
      lastUpdate: 1,
    });
    // No contactRepository.upsert — request not yet accepted by the peer.
    await p2pChatDatabase.messages.put({
      messageId: 'welcome',
      sessionId: 's1',
      peer: { type: 'p2p', accountId: TEST_PEER_SS58, name: 'alice' },
      timestamp: 1000,
      content: { type: 'text', text: 'hi' },
      status: { direction: 'outgoing', state: 'sent' },
      lastUpdate: 1000,
    });

    const changes = await collectChangesSince(0);
    expect(changes.entities.find(e => e.tag === 'Messages')).toBeUndefined();
  });

  it('skips messages whose contact is not yet syncable so they never ship before ChatsAdded', async () => {
    // Contact exists but a pending request for the peer keeps it un-syncable —
    // `ChatsAdded` is suppressed by `isContactSyncable`. Messages must be held
    // back under the same gate; otherwise the welcome would ship to the sibling
    // ahead of (and without) the ChatsAdded that materialises its room, and the
    // sibling would drop it.
    await p2pChatDatabase.rooms.put({
      sessionId: 's1',
      peerId: TEST_PEER_SS58,
      peerUsername: 'alice',
      peerP256PublicKey: '0xff',
      userId: 'u1',
      createdAt: 1,
      lastUpdate: 1,
    });
    await contactRepository.upsert({ accountId: TEST_PEER_SS58, identityChatPublicKey: '0xaa', devices: [] });
    await p2pChatDatabase.requests.put({
      requestId: 'req-1',
      peerId: TEST_PEER_SS58,
      direction: 'outgoing',
      status: 'pending',
      timestamp: 100,
      userId: 'user-1',
      lastUpdate: 100,
    });
    await p2pChatDatabase.messages.put({
      messageId: 'welcome',
      sessionId: 's1',
      peer: { type: 'p2p', accountId: TEST_PEER_SS58, name: 'alice' },
      timestamp: 1000,
      content: { type: 'text', text: 'hi' },
      status: { direction: 'outgoing', state: 'sent' },
      lastUpdate: 1000,
    });

    const changes = await collectChangesSince(0);
    expect(changes.entities.find(e => e.tag === 'ChatsAdded')).toBeUndefined();
    expect(changes.entities.find(e => e.tag === 'Messages')).toBeUndefined();
  });
});
