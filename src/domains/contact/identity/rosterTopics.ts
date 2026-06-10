/**
 * Topic derivation for per-contact device-roster events.
 *
 * Each user broadcasts their own `DeviceAdded` / `DeviceRemoved` events on a
 * topic keyed on their identity sr25519 accountId. Contacts subscribe to the
 * roster topics of every contact in their address book (matchAny across all
 * known contacts) so they learn about device-list changes.
 *
 * Wire format mirrors V1 chat-request topics — same context-prefixed
 * SCALE-encoded blake2b256 — but with a distinct context string so roster
 * events don't collide with chat-request topics.
 *
 *   blake2b-256( SCALE({ context: "device-roster", accountId: userAccountId }) )
 *
 * NOTE: the exact context string and SCALE encoding aren't pinned by the
 * HackMD spec — this is the symmetric extension of V1's `chat-request`
 * topic shape. Confirm with iOS/Android before shipping.
 */

import { blake2b } from '@noble/hashes/blake2.js';
import { Bytes, Struct } from 'scale-ts';

const CONTEXT = new TextEncoder().encode('device-roster');

const RosterTopicInput = Struct({ context: Bytes(), accountId: Bytes() });

export const computeRosterTopic = (userAccountId: Uint8Array): Uint8Array => {
  const encoded = RosterTopicInput.enc({ context: CONTEXT, accountId: userAccountId });
  return blake2b(encoded, { dkLen: 32 });
};

/**
 * The matchAny topic set a recipient subscribes to to track all known
 * contacts' roster events.
 */
export const computeRosterSubscriptionTopics = (contactAccountIds: Uint8Array[]): Uint8Array[] =>
  contactAccountIds.map(computeRosterTopic);
