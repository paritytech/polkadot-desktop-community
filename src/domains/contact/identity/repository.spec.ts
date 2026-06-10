import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { contactDatabase, contactRepository } from './repository';

describe('contactRepository.listChangedSince', () => {
  beforeEach(async () => {
    await contactDatabase.contacts.clear();
    await contactDatabase.removedContacts.clear();
  });

  it('returns only contacts with lastUpdate > t', async () => {
    await contactRepository.upsert({
      accountId: '5A',
      identityChatPublicKey: '0xaa',
      devices: [],
      lastUpdate: 100,
    });
    await contactRepository.upsert({
      accountId: '5B',
      identityChatPublicKey: '0xbb',
      devices: [],
      lastUpdate: 200,
    });
    await contactRepository.upsert({
      accountId: '5C',
      identityChatPublicKey: '0xcc',
      devices: [],
      lastUpdate: 300,
    });

    const got = await contactRepository.listChangedSince(150);
    expect(got.map(c => c.accountId).sort()).toEqual(['5B', '5C']);
  });

  it('upsert without explicit lastUpdate sets it to Date.now()', async () => {
    const before = Date.now();
    await contactRepository.upsert({
      accountId: '5X',
      identityChatPublicKey: '0xff',
      devices: [],
    });
    const got = await contactRepository.get('5X');
    expect(got?.lastUpdate).toBeGreaterThanOrEqual(before);
  });
});

describe('contactRepository tombstones', () => {
  beforeEach(async () => {
    await contactDatabase.contacts.clear();
    await contactDatabase.removedContacts.clear();
  });

  it('user-side delete drops the contact and writes a tombstone', async () => {
    const before = Date.now();
    await contactRepository.upsert({ accountId: '5T', identityChatPublicKey: '0xaa', devices: [] });
    await contactRepository.delete('5T');
    expect(await contactRepository.get('5T')).toBeUndefined();
    const tombstones = await contactRepository.listRemovalsSince(0);
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0]?.accountId).toBe('5T');
    expect(tombstones[0]?.removedAt).toBeGreaterThanOrEqual(before);
  });

  it('applyRemoteDelete drops the contact without writing a tombstone', async () => {
    await contactRepository.upsert({ accountId: '5T', identityChatPublicKey: '0xaa', devices: [] });
    await contactRepository.applyRemoteDelete('5T');
    expect(await contactRepository.get('5T')).toBeUndefined();
    expect(await contactRepository.listRemovalsSince(0)).toHaveLength(0);
  });

  it('re-adding a deleted contact clears the tombstone', async () => {
    await contactRepository.upsert({ accountId: '5T', identityChatPublicKey: '0xaa', devices: [] });
    await contactRepository.delete('5T');
    expect(await contactRepository.listRemovalsSince(0)).toHaveLength(1);
    await contactRepository.upsert({ accountId: '5T', identityChatPublicKey: '0xaa', devices: [] });
    expect(await contactRepository.listRemovalsSince(0)).toHaveLength(0);
  });

  it('listRemovalsSince filters by removedAt > t', async () => {
    await contactRepository.upsert({ accountId: '5T', identityChatPublicKey: '0xaa', devices: [] });
    await contactRepository.delete('5T');
    const after = Date.now() + 1000;
    expect(await contactRepository.listRemovalsSince(after)).toHaveLength(0);
  });

  it('clearAll() empties both contacts and removedContacts tables', async () => {
    await contactRepository.upsert({ accountId: '5T', identityChatPublicKey: '0xaa', devices: [] });
    await contactRepository.upsert({ accountId: '5U', identityChatPublicKey: '0xbb', devices: [] });
    await contactRepository.delete('5T'); // writes a tombstone in `removedContacts`
    expect(await contactRepository.list()).toHaveLength(1);
    expect(await contactRepository.listRemovalsSince(0)).toHaveLength(1);

    await contactRepository.clearAll();

    expect(await contactRepository.list()).toHaveLength(0);
    expect(await contactRepository.listRemovalsSince(0)).toHaveLength(0);
  });
});
