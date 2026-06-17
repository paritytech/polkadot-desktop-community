/**
 * Reads contact + p2p-chat repositories and produces a SyncEntity[] + timePoint
 * covering every local change after `since`. Mapping:
 *   contact.lastUpdate    → ChatsAdded([Contact(accountId)])
 *   contact.removedAt     → ChatsRemoved([Contact(accountId)])
 *   p2p-chat.messages     → Messages([LocalMessage{remote, peerId, status, order}])
 * `LocalMessage.remote` is the byte-for-byte chat-message wire blob; peerId /
 * status / order are sync-local fields placing it into the correct local room.
 */

import { fromHex } from 'polkadot-api/utils';
import { type CodecType } from 'scale-ts';

/* eslint-disable boundaries/dependencies -- direct sub-path imports avoid transitive wasm load (verifiablejs) via @/domains/chat and @/domains/contact roots */
import { environmentUseCase } from '@/domains/application';
import { listMessagesChangedSince, p2pChatDatabase } from '@/domains/chat/p2p/repository';
import {
  type ChatMessageStatus,
  type FileAttachment,
  type FileMeta,
  type MessageContent,
  type RichTextContent,
} from '@/domains/chat/session/types';
import { contactRepository } from '@/domains/contact/identity/repository';
import { type Contact } from '@/domains/contact/identity/types';
/* eslint-enable boundaries/dependencies */

import { type ChatMessageStatementCodec, type LocalMessageCodec, type LocalStatusCodec, type SyncEntityCodec } from './codec';
import { encodeAccountIdSs58 } from './ss58';

type SyncEntity = CodecType<typeof SyncEntityCodec>;
type LocalMessage = CodecType<typeof LocalMessageCodec>;
type LocalStatus = CodecType<typeof LocalStatusCodec>;
type ChatMessageStatement = CodecType<typeof ChatMessageStatementCodec>;
type WireMessageContent = Extract<ChatMessageStatement['versioned'], { tag: 'v1' }>['value'];
type WireRichText = Extract<WireMessageContent, { tag: 'richText' }>['value'];
type WireAttachment = NonNullable<WireRichText['attachments']>[number];
type WireMeta = WireAttachment['value']['meta'];

function mapFileMetaToWire(meta: FileMeta): WireMeta {
  if (meta.type === 'image') {
    return {
      tag: 'image',
      value: {
        general: { mimeType: meta.mimeType, fileSize: meta.fileSize },
        width: meta.width,
        height: meta.height,
        thumbnail: undefined,
      },
    };
  }
  if (meta.type === 'video') {
    return {
      tag: 'video',
      value: { general: { mimeType: meta.mimeType, fileSize: meta.fileSize }, duration: meta.duration, thumbnail: undefined },
    };
  }
  return { tag: 'general', value: { mimeType: meta.mimeType, fileSize: meta.fileSize } };
}

type WireNodeEndpoint = NonNullable<WireAttachment['value']['nodeEndpoint']>;

// `defaultEndpoint` (the active env's first HOP endpoint) is resolved by the
// caller and threaded in, since these mappers are synchronous and config is async.
function buildWireNodeEndpoint(stored: string | undefined, defaultEndpoint: string): WireNodeEndpoint {
  return { tag: 'wssUrl', value: { url: stored ?? defaultEndpoint } };
}

function mapAttachmentsToWire(attachments: FileAttachment[] | undefined, defaultEndpoint: string): WireAttachment[] | undefined {
  if (!attachments) return undefined;
  const out: WireAttachment[] = [];
  for (const a of attachments) {
    out.push({
      tag: 'p2pMixnet',
      value: {
        identifier: a.identifier,
        claimTicket: a.claimTicket,
        nodeEndpoint: buildWireNodeEndpoint(a.nodeEndpoint, defaultEndpoint),
        meta: mapFileMetaToWire(a.meta),
      },
    });
  }
  return out;
}

function mapRichTextToWire(content: RichTextContent, defaultEndpoint: string): WireRichText {
  return { text: content.text, attachments: mapAttachmentsToWire(content.attachments, defaultEndpoint) };
}

function mapContentToWire(content: MessageContent, defaultEndpoint: string): WireMessageContent | null {
  switch (content.type) {
    case 'text':
      return { tag: 'text', value: content.text };
    case 'richText':
      return { tag: 'richText', value: mapRichTextToWire(content, defaultEndpoint) };
    case 'reacted':
      return { tag: 'reacted', value: { messageId: content.messageId, emoji: content.emoji } };
    case 'reactionRemoved':
      return { tag: 'reactionRemoved', value: { messageId: content.messageId, emoji: content.emoji } };
    case 'contactAdded':
      return { tag: 'contactAdded', value: undefined };
    case 'leftChat':
      return { tag: 'leftChat', value: undefined };
    case 'token':
      // Peer push token rides device-sync as a `token` Message (Android parity:
      // no statement-type deny-list — Token passes through). `content.token` is
      // stored without the `0x` prefix; the wire `Hex` codec wants it prefixed.
      return { tag: 'token', value: { token: `0x${content.token}`, platform: content.platform } };
    case 'deviceChatAccepted':
      return {
        tag: 'deviceChatAccepted',
        value: {
          requestId: content.requestId,
          device: {
            statementAccountId: fromHex(content.statementAccountId),
            encryptionPublicKey: fromHex(content.encryptionPublicKey),
          },
        },
      };
    case 'deviceAdded':
      return {
        tag: 'deviceAdded',
        value: {
          statementAccountId: fromHex(content.statementAccountId),
          encryptionPublicKey: fromHex(content.encryptionPublicKey),
        },
      };
    case 'edit':
      return {
        tag: 'edit',
        value: { messageId: content.messageId, newContent: mapRichTextToWire(content.newContent, defaultEndpoint) },
      };
    case 'reply': {
      const inner = content.content;
      if (inner.type === 'richText') {
        return {
          tag: 'reply',
          value: { messageId: content.messageId, ownContent: mapRichTextToWire(inner, defaultEndpoint) },
        };
      }
      if (inner.type === 'text') {
        return {
          tag: 'reply',
          value: { messageId: content.messageId, ownContent: { text: inner.text, attachments: undefined } },
        };
      }
      return null;
    }
    case 'custom':
      return null;
    default:
      return null;
  }
}

function statusToWire(status: ChatMessageStatus): LocalStatus {
  if (status.direction === 'outgoing') {
    if (status.state === 'new') return { tag: 'Outgoing', value: { tag: 'NEW', value: undefined } };
    if (status.state === 'sent') return { tag: 'Outgoing', value: { tag: 'SENT', value: undefined } };
    return { tag: 'Outgoing', value: { tag: 'DELIVERED', value: undefined } };
  }
  if (status.state === 'new') return { tag: 'Incoming', value: { tag: 'NEW', value: undefined } };
  return { tag: 'Incoming', value: { tag: 'SEEN', value: undefined } };
}

export type CollectedChanges = {
  entities: SyncEntity[];
  timePoint: number;
};

/**
 * A contact only propagates to our other devices once its chat request is
 * established (accepted or non-existent — incoming requests are accepted via
 * the V2 flow, outgoing start in `pending` until the peer accepts). Sync has
 * no chat-request entity, so syncing a still-pending contact would surface it
 * on the sibling as a normal writable chat instead of a "request sent" one.
 * Mirrors Android `DeviceSyncFilter.isContactSyncable` (gates on
 * `establishedAt != null`) and iOS `acceptedContacts` predicate.
 */
async function isContactSyncable(contact: Contact): Promise<boolean> {
  const requests = await p2pChatDatabase.requests.where('peerId').equals(contact.accountId).toArray();
  return !requests.some(r => r.status === 'pending');
}

export async function collectChangesSince(since: number): Promise<CollectedChanges> {
  const entities: SyncEntity[] = [];

  // Match Android's `runSyncRound` semantics: capture wall-clock once at the
  // start of the round and use it as the new checkpoint after a successful
  // Ack. "Captured after the read so the new checkpoint covers exactly what
  // we just collected." Filtered items (pending contacts, contactAdded
  // legacy) don't get a per-item advance — instead their next mutation
  // bumps `lastUpdate > timePoint` and they re-appear on the next pump.
  const timePoint = Date.now();

  const changedContacts = await contactRepository.listChangedSince(since);
  if (changedContacts.length > 0) {
    const syncableContacts: Contact[] = [];
    for (const c of changedContacts) {
      if (await isContactSyncable(c)) syncableContacts.push(c);
    }
    if (syncableContacts.length > 0) {
      const chatIds = syncableContacts.map(c => ({
        tag: 'Contact' as const,
        value: encodeAccountIdSs58(c.accountId),
      }));
      entities.push({ tag: 'ChatsAdded', value: chatIds });
    }
  }

  const removedContacts = await contactRepository.listRemovalsSince(since);
  if (removedContacts.length > 0) {
    const chatIds = removedContacts.map(t => ({
      tag: 'Contact' as const,
      value: encodeAccountIdSs58(t.accountId),
    }));
    entities.push({ tag: 'ChatsRemoved', value: chatIds });
  }

  const changedMessages = await listMessagesChangedSince(since);
  if (changedMessages.length > 0) {
    const localMessages: LocalMessage[] = [];
    const syncableByPeer = new Map<string, boolean>();
    for (const m of changedMessages) {
      // Legacy `contactAdded` content tag (codec index 3): pre-multi-device
      // UI-only system marker. Not in the current chat spec — sibling
      // appliers auto-generate `req-accepted:{requestId}` when they apply
      // `deviceChatAccepted`. Keep the local row for our own chat UI, but
      // skip it from the wire.
      if (m.content.type === 'contactAdded') continue;

      const room = await p2pChatDatabase.rooms.get(m.sessionId);
      if (!room) continue;
      // Variant 2 (aligned with Android PApp): a "chat" exists only once the
      // peer has accepted the request — i.e. a `Contact` row exists. Rooms
      // are created at sendRequest time, so gating on `room` alone would
      // leak the outgoing welcome before the peer accepts. Skip until the
      // contact appears; the welcome write at accept time bumps its
      // `lastUpdate` so it gets picked up by the next pump together with
      // `ChatsAdded`.
      const contact = await contactRepository.get(room.peerId);
      if (!contact) continue;
      // Gate messages on the SAME syncability predicate as ChatsAdded: a
      // contact can exist while still un-syncable (a pending chat request for
      // the peer keeps `isContactSyncable` false). Shipping a message for such
      // a contact would put it on the wire before — or entirely without — the
      // ChatsAdded that materialises its room on the sibling, which then drops
      // it for lack of a room. Holding messages under the same gate guarantees
      // a message never precedes its ChatsAdded; once the request is
      // established, the contact's `lastUpdate` bump re-emits ChatsAdded and
      // the (re-stamped) message rides the same or a later round.
      let syncable = syncableByPeer.get(room.peerId);
      if (syncable === undefined) {
        syncable = await isContactSyncable(contact);
        syncableByPeer.set(room.peerId, syncable);
      }
      if (!syncable) continue;
      const peerAccountId = encodeAccountIdSs58(room.peerId);
      const defaultEndpoint = (await environmentUseCase.getActive()).bulletinHopEndpoints?.[0] ?? '';
      const wireContent = mapContentToWire(m.content, defaultEndpoint);
      if (!wireContent) continue;
      const remote: ChatMessageStatement = {
        messageId: m.messageId,
        timestamp: BigInt(m.timestamp),
        versioned: { tag: 'v1', value: wireContent },
      };
      localMessages.push({
        remote,
        peerId: peerAccountId,
        status: statusToWire(m.status),
        order: BigInt(m.timestamp),
      });
    }
    if (localMessages.length > 0) entities.push({ tag: 'Messages', value: localMessages });
  }

  return { entities, timePoint };
}
