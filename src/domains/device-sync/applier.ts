/**
 * Applies inbound `SyncEntity[]` payloads to local repositories. Idempotent
 * by (Contact accountId | message id | LocalDevice statement hex). Entries
 * with no local equivalent (non-Contact chatId, missing room, unmappable
 * content) are dropped silently. ChatsAdded fetches Contact{chatKey,username}
 * from on-chain `Resources.Consumers`; failed lookups skip until next delivery.
 */

import { AccountId } from '@polkadot-api/substrate-bindings';
import { toHex } from 'polkadot-api/utils';
import { type CodecType } from 'scale-ts';

/* eslint-disable boundaries/dependencies -- direct sub-path imports avoid pulling
   wasm-loading transitive deps (rosterSubscriber → attestationService → verifiablejs)
   into the vitest sandbox; same workaround as collector.ts */
import { p2pChatDatabase } from '@/domains/chat/p2p/repository';
import { p2pService } from '@/domains/chat/p2p/service';
import { chatContentService } from '@/domains/chat/p2p/session-transport/service';
import { chatMessageService } from '@/domains/chat/session/service';
import { type ChatMessage, type ChatMessageStatus } from '@/domains/chat/session/types';
import { contactRepository } from '@/domains/contact/identity/repository';
import { type Device } from '@/domains/contact/identity/types';
import { isValidEncryptionPublicKey } from '@/domains/device';
/* eslint-enable boundaries/dependencies */

import { type ChatIdCodec, type ChatMessageStatementCodec, type LocalStatusCodec, type SyncEntityCodec } from './codec';
import { deviceSyncRepository } from './repository';

type SyncEntity = CodecType<typeof SyncEntityCodec>;
type ChatId = CodecType<typeof ChatIdCodec>;
type LocalStatus = CodecType<typeof LocalStatusCodec>;
type ChatMessageStatement = CodecType<typeof ChatMessageStatementCodec>;
type WireMessageContent = Extract<ChatMessageStatement['versioned'], { tag: 'v1' }>['value'];

/** Resolves on-chain ConsumerInfo so a Contact upsert can be built from a bare ChatsAdded(Contact). Injected to keep the applier decoupled from the papi client. */
export type ConsumerInfoLookup = (accountId: string) => Promise<{ chatKey: Uint8Array; username: string } | null>;

export type ApplierContext = {
  resolveConsumerInfo: ConsumerInfoLookup;
  /** Own user SS58 — written into `P2PRoom.userId` so the synced room appears under the current session in the chat list. */
  ownUserId: string;
};

const accountIdCodec = AccountId();

function decodeChatIdToSs58(chatId: ChatId): string | null {
  if (chatId.tag === 'Contact') return accountIdCodec.dec(chatId.value);
  return null;
}

function statusFromWire(status: LocalStatus): ChatMessageStatus {
  if (status.tag === 'Outgoing') {
    const inner = status.value.tag;
    if (inner === 'NEW') return { direction: 'outgoing', state: 'new' };
    if (inner === 'SENT') return { direction: 'outgoing', state: 'sent' };
    return { direction: 'outgoing', state: 'delivered' };
  }
  const inner = status.value.tag;
  if (inner === 'NEW') return { direction: 'incoming', state: 'new' };
  return { direction: 'incoming', state: 'seen' };
}

function unwrapMessageContent(remote: ChatMessageStatement): WireMessageContent | null {
  if (remote.versioned.tag !== 'v1') return null;
  return remote.versioned.value;
}

export async function applySyncEntities(entities: SyncEntity[], ctx: ApplierContext): Promise<void> {
  for (const entity of entities) {
    if (entity.tag === 'ChatsAdded') {
      for (const chatId of entity.value) {
        const ss58 = decodeChatIdToSs58(chatId);
        if (!ss58) {
          console.warn('[applier] ChatsAdded: non-Contact chatId tag=%s, skipping', chatId.tag);
          continue;
        }
        const existing = await contactRepository.get(ss58);
        if (existing) {
          continue;
        }
        let info;
        try {
          info = await ctx.resolveConsumerInfo(ss58);
        } catch (e) {
          console.warn(
            '[applier] ChatsAdded: resolveConsumerInfo(%s) threw: %s',
            ss58,
            e instanceof Error ? e.message : String(e),
          );
          continue;
        }
        if (!info) {
          console.warn(
            '[applier] ChatsAdded: resolveConsumerInfo(%s) → null (no on-chain Resources.Consumers entry), skipping',
            ss58,
          );
          continue;
        }
        const chatKeyHex = toHex(info.chatKey);
        await contactRepository.upsert({
          accountId: ss58,
          identityChatPublicKey: chatKeyHex,
          devices: [],
        });

        // Also materialise a P2PRoom — chat list UI reads from
        // `p2pChatDatabase.rooms` (via `useP2PSessions`), not contactRepository.
        const existingRoom = await p2pChatDatabase.rooms.get(ss58);
        if (!existingRoom) {
          const now = Date.now();
          await p2pChatDatabase.rooms.put(
            p2pService.stampRoom({
              sessionId: ss58,
              peerId: ss58,
              peerUsername: info.username,
              peerP256PublicKey: chatKeyHex,
              userId: ctx.ownUserId,
              createdAt: now,
              lastUpdate: now,
            }),
          );
        } else if (existingRoom.userId !== ctx.ownUserId) {
          // Repair rooms left over from a previous bootstrap that wrote the
          // wrong `userId` — without this the chat-list hook can't see them.
          await p2pChatDatabase.rooms.update(ss58, p2pService.stampRoom({ ...existingRoom, userId: ctx.ownUserId }));
        }

        // Any pending incoming chat request from this peer is now redundant —
        // Android already established the chat relationship and pushed it via
        // sync. Mark them accepted so the chat-list filter
        // (`!pendingPeerIds.has(sessionId)` in ChatFullscreen) doesn't hide
        // the synced room behind a "New Requests" badge.
        const pendingForPeer = await p2pChatDatabase.requests
          .where('peerId')
          .equals(ss58)
          .filter(r => r.direction === 'incoming' && r.status === 'pending')
          .toArray();
        for (const req of pendingForPeer) {
          await p2pChatDatabase.requests.update(req.requestId, { status: 'accepted', lastUpdate: Date.now() });

          // This Desktop received B's incoming request directly (both siblings
          // subscribe to the incoming-requests topic), so the request row
          // carries B's device key (`senderDevicePubKey` +
          // `senderDeviceStatementAccountId`). The local `acceptRequest` path
          // copies that into `Contact.devices`; the ChatsAdded sync auto-accept
          // (this path) is reached instead when a *sibling* accepted, and must
          // do the same — otherwise the contact stays device-less and V2
          // `startSession` aborts at the `devices.length === 0` gate. Mirror
          // `upsertContactWithDevice`: fall back to the peer identity account
          // when the device statement account wasn't carried, and dedup on both
          // statementAccountId and encryptionPublicKey.
          if (req.senderDevicePubKey) {
            const statementAccountIdHex = req.senderDeviceStatementAccountId ?? toHex(accountIdCodec.enc(ss58));
            const incomingDevice: Device = {
              statementAccountId: statementAccountIdHex,
              encryptionPublicKey: req.senderDevicePubKey,
            };
            const contact = await contactRepository.get(ss58);
            if (contact) {
              const without = contact.devices.filter(
                d =>
                  d.statementAccountId !== incomingDevice.statementAccountId &&
                  d.encryptionPublicKey !== incomingDevice.encryptionPublicKey,
              );
              await contactRepository.upsert({ ...contact, devices: [...without, incomingDevice] });
            }
          }
          // Mirror manual acceptRequest: materialise the request's welcomeMessage
          // AND the "contactAdded" system row so the auto-accepted chat looks the
          // same as one accepted via the UI. Both live only on the request row
          // (welcome) or are generated by acceptRequest (contactAdded); without
          // this the synced chat shows just the post-accept messages.
          const contactAddedId = `req-accepted:${req.requestId}`;
          const existingContactAdded = await p2pChatDatabase.messages.get(contactAddedId);
          if (!existingContactAdded) {
            await p2pChatDatabase.messages.put(
              p2pService.stampMessage({
                messageId: contactAddedId,
                sessionId: ss58,
                peer: { type: 'p2p', accountId: ctx.ownUserId, name: '' },
                timestamp: req.timestamp,
                content: { type: 'contactAdded' },
                status: { direction: 'outgoing', state: 'delivered' },
              }),
            );
          }
          if (req.welcomeMessage) {
            const existingWelcome = await p2pChatDatabase.messages.get(req.requestId);
            if (!existingWelcome) {
              await p2pChatDatabase.messages.put(
                p2pService.stampMessage({
                  messageId: req.requestId,
                  sessionId: ss58,
                  peer: { type: 'p2p', accountId: ss58, name: req.peerUsername ?? '' },
                  // -1 so welcome sorts before the contactAdded system row in the
                  // chat (semantic order: "they sent welcome → we accepted").
                  timestamp: req.timestamp - 1,
                  content: { type: 'text', text: req.welcomeMessage },
                  status: { direction: 'incoming', state: 'seen' },
                }),
              );
            }
          }
        }
      }
    } else if (entity.tag === 'ChatsRemoved') {
      for (const chatId of entity.value) {
        const ss58 = decodeChatIdToSs58(chatId);
        if (!ss58) continue;
        await contactRepository.applyRemoteDelete(ss58);
        // Drop the room too so the chat list reflects the removal. Messages
        // under the (now-orphaned) sessionId stay until a future cleanup pass.
        await p2pChatDatabase.rooms.delete(ss58);
      }
    } else if (entity.tag === 'Messages') {
      // `token` (LWW per peer) and `deviceAdded` / `deviceRemoved` (idempotent
      // set-ops on Contact.devices) are order-sensitive when replayed — apply
      // them in sender-declared order. Android emits ORDER BY timestamp ASC,
      // but the wire `order` is the explicit sort hint, so don't rely on
      // the sender being correct.
      const ordered = [...entity.value].sort((a, b) => {
        if (a.order < b.order) return -1;
        if (a.order > b.order) return 1;
        return 0;
      });
      for (const m of ordered) {
        const messageId = m.remote.messageId;
        const wireContent = unwrapMessageContent(m.remote);
        if (!wireContent) {
          continue;
        }
        const peerSs58 = accountIdCodec.dec(m.peerId);

        // `chatAccepted` is Android's legacy alias for `deviceChatAccepted` and
        // is consumed by the accept-signal listener directly; if sync replays
        // it the acceptance has already been processed upstream, so drop to
        // avoid duplicate `contactAdded` system rows. Mirrors the live receive
        // path in `managerV2Factory.ts`.
        //   TODO(android-migrate): drop this branch when Android emits
        //   `deviceChatAccepted @20` exclusively.
        if (wireContent.tag === 'chatAccepted') continue;

        // Per-peer state messages: don't materialise as chat history. We only
        // care about the peer-emitted variants (Incoming); the Outgoing copies
        // describe our own device and are useless on this device.
        // `deviceChatAccepted` is the only sibling-originating signal in this
        // group — written locally by the V2 manager's `pendingAcceptMatchers`
        // when **our** side received the acceptor's `deviceChatAccepted` via
        // the identity-channel listener, then replicated here via sync to
        // catch up sibling paired devices that didn't see the identity
        // channel signal.
        if (
          wireContent.tag === 'token' ||
          wireContent.tag === 'deviceAdded' ||
          wireContent.tag === 'deviceRemoved' ||
          wireContent.tag === 'deviceChatAccepted'
        ) {
          if (m.status.tag !== 'Incoming') continue;

          if (wireContent.tag === 'token') {
            const platform = wireContent.value.platform;
            // iOSVoIP is CallKit-only — desktop never initiates calls so the
            // VoIP token can't be used. Skip without trampling the regular
            // `'Android' | 'iOS'` value on `peerPlatform`.
            if (platform !== 'Android' && platform !== 'iOS') continue;
            const tokenHex = typeof wireContent.value.token === 'string' ? wireContent.value.token.replace(/^0x/, '') : '';
            if (!tokenHex) continue;
            await p2pChatDatabase.rooms
              .where('peerId')
              .equals(peerSs58)
              .modify({ peerPushToken: tokenHex, peerPlatform: platform });
            continue;
          }

          if (wireContent.tag === 'deviceAdded') {
            const existing = await contactRepository.get(peerSs58);
            if (!existing) {
              console.debug('[DEVICE-TRACE] applier RECV deviceAdded but contact unknown peer=%s — skipping', peerSs58);
              continue;
            }
            const incoming: Device = {
              statementAccountId: toHex(wireContent.value.statementAccountId),
              encryptionPublicKey: toHex(wireContent.value.encryptionPublicKey),
            };
            const without = existing.devices.filter(d => d.statementAccountId !== incoming.statementAccountId);
            console.debug(
              '[DEVICE-TRACE] applier RECV deviceAdded via sibling-MDS:\n  peerSs58(contact)=%s\n  incoming.stmtAcct=%s\n  incoming.encPub=%s\n  existing.devices BEFORE=%o\n  existing.devices AFTER=[…, incoming] (replace-by-stmtAcct, %d → %d devices)',
              peerSs58,
              incoming.statementAccountId,
              incoming.encryptionPublicKey,
              existing.devices.map(d => d.statementAccountId),
              existing.devices.length,
              without.length + 1,
            );
            await contactRepository.upsert({ ...existing, devices: [...without, incoming] });
            continue;
          }

          if (wireContent.tag === 'deviceChatAccepted') {
            const { requestId, device } = wireContent.value;
            const existing = await contactRepository.get(peerSs58);
            if (!existing) {
              console.debug('[DEVICE-TRACE] applier RECV deviceChatAccepted but contact unknown peer=%s — skipping', peerSs58);
              continue;
            }
            const incoming: Device = {
              statementAccountId: toHex(device.statementAccountId),
              encryptionPublicKey: toHex(device.encryptionPublicKey),
            };
            const without = existing.devices.filter(d => d.statementAccountId !== incoming.statementAccountId);
            console.debug(
              '[DEVICE-TRACE] applier RECV deviceChatAccepted via sibling-MDS:\n  peerSs58(contact)=%s\n  requestId=%s\n  incoming.stmtAcct=%s\n  incoming.encPub=%s\n  existing.devices BEFORE=%o\n  AFTER=[…, incoming] (%d → %d devices)',
              peerSs58,
              requestId,
              incoming.statementAccountId,
              incoming.encryptionPublicKey,
              existing.devices.map(d => d.statementAccountId),
              existing.devices.length,
              without.length + 1,
            );
            await contactRepository.upsert({ ...existing, devices: [...without, incoming] });
            // Mirror local accept-signal handler: flip the matching outgoing
            // request row to `accepted` so the chat list and request UI converge
            // with the sibling device that originally received the signal.
            const requestRow = await p2pChatDatabase.requests.get(requestId);
            if (requestRow && requestRow.direction === 'outgoing' && requestRow.status === 'pending') {
              await p2pChatDatabase.requests.update(requestId, {
                status: 'accepted',
                lastUpdate: Date.now(),
              });
            }
            // Mirror the matcher path: surface a `contactAdded` system row so
            // the UI shows "Accepted the request". Without this the side-effect
            // updates above happen silently and the chat list looks unchanged.
            // Shared messageId with the matcher write so a sibling that already
            // wrote it locally collapses both into a single row.
            const acceptedId = `req-accepted:${requestId}`;
            const existingAccepted = await p2pChatDatabase.messages.get(acceptedId);
            if (!existingAccepted) {
              const room = await p2pChatDatabase.rooms.where('peerId').equals(peerSs58).first();
              await p2pChatDatabase.messages.put(
                p2pService.stampMessage({
                  messageId: acceptedId,
                  sessionId: room?.sessionId ?? peerSs58,
                  peer: { type: 'p2p', accountId: peerSs58, name: room?.peerUsername ?? peerSs58 },
                  timestamp: Number(m.remote.timestamp),
                  content: { type: 'contactAdded' },
                  status: { direction: 'incoming', state: 'seen' },
                }),
              );
            }
            continue;
          }

          // deviceRemoved
          const existing = await contactRepository.get(peerSs58);
          if (!existing) {
            continue;
          }
          const removedHex = toHex(wireContent.value.statementAccountId);
          await contactRepository.upsert({
            ...existing,
            devices: existing.devices.filter(d => d.statementAccountId !== removedHex),
          });
          continue;
        }

        const existing = await p2pChatDatabase.messages.get(messageId);
        if (existing) {
          // Status can advance via a sibling device's sync (e.g. iOS or Android
          // marked the outgoing message as read → DELIVERED). Other fields stay
          // immutable — first-write wins.
          const incomingStatus = statusFromWire(m.status);
          if (chatMessageService.shouldUpgradeStatus(existing.status, incomingStatus)) {
            await p2pChatDatabase.messages.update(messageId, {
              status: incomingStatus,
              lastUpdate: Date.now(),
            });
          }
          continue;
        }
        const room = await p2pChatDatabase.rooms.where('peerId').equals(peerSs58).first();
        if (!room) {
          // The peer's `ChatsAdded` row never materialised (typically because
          // `resolveConsumerInfo` returned null for an account with no on-chain
          // Resources.Consumers entry). Surface so future syncs are debuggable.
          console.warn('[applier] Messages: %s tag=%s peer=%s — no local room, dropping', messageId, wireContent.tag, peerSs58);
          continue;
        }
        const localContent = chatContentService.mapSdkContent(wireContent);
        if (!localContent) {
          console.warn('[applier] Messages: %s tag=%s — mapSdkContent returned null, dropping', messageId, wireContent.tag);
          continue;
        }
        const localMessage: ChatMessage = {
          messageId,
          sessionId: room.sessionId,
          peer: { type: 'p2p', accountId: room.peerId, name: room.peerUsername },
          timestamp: Number(m.remote.timestamp),
          content: localContent,
          status: statusFromWire(m.status),
        };
        await p2pChatDatabase.messages.put(p2pService.stampMessage(localMessage));
      }
    } else if (entity.tag === 'Devices') {
      for (const d of entity.value) {
        const stmtHex = toHex(d.statementAccountId);
        // Wire data — never persist a device whose enc key can't serve ECDH;
        // a poisoned row crashes orchestrator spawns and fans out to chat
        // peers via `deviceAdded` (breaking THEIR sends to us wholesale).
        if (!isValidEncryptionPublicKey(d.encryptionPublicKey)) {
          console.warn(
            '[applier] Devices: skipping device=%s — encryptionPublicKey is not a valid P-256 key (len=%d)',
            stmtHex,
            d.encryptionPublicKey.length,
          );
          continue;
        }
        // Merge, never overwrite: a re-announced device must keep its persisted
        // `lastOfferId` (restart recovery) and `outgoingUpdateTime` checkpoint.
        await deviceSyncRepository.upsertFromRoster({
          statementAccountId: stmtHex,
          encryptionPublicKey: toHex(d.encryptionPublicKey),
          lastUpdate: Number(d.lastUpdate),
        });
      }
    }
  }
}
