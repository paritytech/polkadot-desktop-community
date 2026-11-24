/**
 * Contact write commands — the chokepoint for mutating the local contact list.
 *
 * These compose contact persistence with the device-sync "local change" signal
 * so a local mutation immediately pokes the sync pump (instead of waiting for
 * the collector's next poll). Keeping the emit here — not in `repository.ts` —
 * is why the repository stays a pure persistence leaf: emitting a cross-domain
 * signal is orchestration, which belongs in a use case.
 *
 * Signal policy (unchanged from the old repository behaviour):
 *   upsert / delete       → local change, signal sync.
 *   deleteContactWithoutSync → drop with no tombstone and no signal, for a removal every own device applies
 *                              on its own (inbound ChatsRemoved, chat request cancel).
 */

import { signalLocalChange } from '@/domains/device-sync';
import { contactRepository } from '../identity/repository';
import { type Contact } from '../identity/types';

const upsertContact = async (contact: Omit<Contact, 'lastUpdate'> & Partial<Pick<Contact, 'lastUpdate'>>): Promise<void> => {
  await contactRepository.upsert(contact);
  signalLocalChange();
};

const deleteContact = async (accountId: string): Promise<void> => {
  await contactRepository.delete(accountId);
  signalLocalChange();
};

/**
 * Drop the contact with no tombstone and no sync signal, for a removal every own device applies on its own: an
 * inbound `ChatsRemoved`, and a chat request cancel, which every own device receives itself.
 */
const deleteContactWithoutSync = async (accountId: string): Promise<void> => {
  await contactRepository.applyRemoteDelete(accountId);
};

export const contactWriteUseCase = {
  upsertContact,
  deleteContact,
  deleteContactWithoutSync,
};
