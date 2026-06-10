/**
 * Subscriber that listens for `DeviceRosterEvent` (DeviceAdded / DeviceRemoved)
 * statements published by known contacts, verifies they're signed by the
 * contact's own user-identity sr25519 key, and updates the local
 * `Contact.devices[]` accordingly.
 *
 * Topic strategy: one matchAny subscription across the roster topics of
 * every known contact (see `rosterTopics.ts`). Statements arriving on those
 * topics are filtered by `proof.signer == contact.accountId` before being
 * applied — this is the off-chain trust path for V2 messaging (Q4): only
 * the contact's own user identity sr25519 can broadcast a roster mutation.
 *
 * Lifecycle: `startRosterSubscriber(deps).then(stop)`. `stop()` is idempotent
 * and tears down the underlying tracked subscription. The subscriber takes a
 * static contact list snapshot at start time; re-subscription on contact list
 * mutations is a follow-up wiring concern in the chat-manager.
 */

import { type Statement } from '@novasamatech/sdk-statement';
import { type StatementStoreAdapter } from '@novasamatech/statement-store';

import { trackedSubscribeStatements } from '@/domains/chat';

import { DeviceRosterEvent } from './device-event-codec';
import { contactRepository as defaultContactRepository } from './repository';
import { contactService } from './service';
import { type Contact } from './types';

const fromHex = (hex: string): Uint8Array => {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
};

export type RosterSubscriberDeps = {
  statementStore: StatementStoreAdapter;
  contacts: Contact[];
  contactRepository?: typeof defaultContactRepository;
};

const verifySigner = (stmt: Statement, expectedAccountId: string): boolean => {
  if (!stmt.proof || stmt.proof.type !== 'sr25519') return false;
  // proof.value.signer is a hex string (SizedHex<32>); contact.accountId is also hex.
  // Normalize the 0x prefix before comparing.
  const a = stmt.proof.value.signer.startsWith('0x') ? stmt.proof.value.signer : `0x${stmt.proof.value.signer}`;
  const b = expectedAccountId.startsWith('0x') ? expectedAccountId : `0x${expectedAccountId}`;
  return a.toLowerCase() === b.toLowerCase();
};

const applyAndPersist = async (contact: Contact, stmt: Statement, repo: typeof defaultContactRepository): Promise<void> => {
  if (!stmt.data) return;

  let event: ReturnType<typeof DeviceRosterEvent.dec>;
  try {
    event = DeviceRosterEvent.dec(stmt.data);
  } catch (err) {
    console.warn('[roster-subscriber] failed to decode DeviceRosterEvent', err);
    return;
  }

  const next = contactService.applyRosterEvent(contact, event);
  await repo.upsert(next);
};

export const startRosterSubscriber = (deps: RosterSubscriberDeps): VoidFunction => {
  const { statementStore, contacts } = deps;
  const repo = deps.contactRepository ?? defaultContactRepository;

  if (contacts.length === 0) return () => {};

  const topics = contacts.map(c => fromHex(c.accountId).slice(0, 32));
  const contactsByAccountId = new Map<string, Contact>();
  for (const c of contacts) {
    contactsByAccountId.set(c.accountId.toLowerCase(), c);
  }

  return trackedSubscribeStatements(statementStore, { matchAny: topics }, ({ statements }) => {
    for (const stmt of statements) {
      if (!stmt.proof || stmt.proof.type !== 'sr25519') continue;

      const signerKey = (
        stmt.proof.value.signer.startsWith('0x') ? stmt.proof.value.signer : `0x${stmt.proof.value.signer}`
      ).toLowerCase();
      const contact = contactsByAccountId.get(signerKey);
      if (!contact) continue;
      if (!verifySigner(stmt, contact.accountId)) continue;

      void applyAndPersist(contact, stmt, repo);
    }
  });
};
