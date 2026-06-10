import Dexie, { type Table } from 'dexie';

/* eslint-disable-next-line boundaries/dependencies -- leaf signal module; importing
   via @/domains/device-sync index would create a cycle (device-sync/applier
   imports this repository). */
import { signalLocalChange } from '@/domains/device-sync/localChangeSignal';

import { type Contact } from './types';

/**
 * Tombstone written when a user deletes a contact locally. Read by the sync
 * collector to emit `ChatsRemoved` so other own-devices drop the contact too.
 * Cleared when the same contact is re-added — otherwise sync would replicate
 * a stale removal.
 */
export type RemovedContactTombstone = {
  accountId: string;
  removedAt: number; // ms since epoch
};

class ContactDatabase extends Dexie {
  contacts: Table<Contact, string>;
  removedContacts: Table<RemovedContactTombstone, string>;

  constructor() {
    super('contact');
    this.version(1).stores({
      contacts: 'accountId',
    });
    this.version(2)
      .stores({
        contacts: 'accountId, lastUpdate',
      })
      .upgrade(async tx => {
        await tx
          .table<Contact>('contacts')
          .toCollection()
          .modify(c => {
            if (typeof c.lastUpdate !== 'number') c.lastUpdate = Date.now();
          });
      });
    this.version(3).stores({
      contacts: 'accountId, lastUpdate',
      removedContacts: 'accountId, removedAt',
    });
    this.contacts = this.table('contacts');
    this.removedContacts = this.table('removedContacts');
  }
}

export const contactDatabase = new ContactDatabase();

export const contactRepository = {
  get: (accountId: string): Promise<Contact | undefined> => contactDatabase.contacts.get(accountId),

  list: (): Promise<Contact[]> => contactDatabase.contacts.toArray(),

  listChangedSince: (timestamp: number): Promise<Contact[]> =>
    contactDatabase.contacts.where('lastUpdate').above(timestamp).toArray(),

  upsert: async (contact: Omit<Contact, 'lastUpdate'> & Partial<Pick<Contact, 'lastUpdate'>>): Promise<void> => {
    const withTimestamp: Contact = { ...contact, lastUpdate: contact.lastUpdate ?? Date.now() };
    await contactDatabase.transaction('rw', contactDatabase.contacts, contactDatabase.removedContacts, async () => {
      await contactDatabase.contacts.put(withTimestamp);
      await contactDatabase.removedContacts.delete(contact.accountId);
    });
    signalLocalChange();
  },

  /** User-initiated removal: drop + write tombstone so sync replicates the deletion to own-devices. */
  delete: async (accountId: string): Promise<void> => {
    await contactDatabase.transaction('rw', contactDatabase.contacts, contactDatabase.removedContacts, async () => {
      await contactDatabase.contacts.delete(accountId);
      await contactDatabase.removedContacts.put({ accountId, removedAt: Date.now() });
    });
    signalLocalChange();
  },

  /** Inbound sync removal: drop WITHOUT tombstone so we don't echo the deletion back. */
  applyRemoteDelete: async (accountId: string): Promise<void> => {
    await contactDatabase.contacts.delete(accountId);
  },

  listRemovalsSince: (timestamp: number): Promise<RemovedContactTombstone[]> =>
    contactDatabase.removedContacts.where('removedAt').above(timestamp).toArray(),

  /** Called on handshake re-pair — the contact list belongs to the previous user identity. */
  clearAll: async (): Promise<void> => {
    await contactDatabase.transaction('rw', contactDatabase.contacts, contactDatabase.removedContacts, async () => {
      await contactDatabase.contacts.clear();
      await contactDatabase.removedContacts.clear();
    });
  },
};
