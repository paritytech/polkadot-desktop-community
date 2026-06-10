/**
 * V2 multi-device P2P chat manager factory — aligned with Android
 * `base-multi-device`.
 *
 * Scope of this iteration (matches the user's test plan):
 *   - **Send V2 chat request** to a peer using the V1-shape envelope keyed on
 *     the recipient's user accountId, with `RequestContentV2` carrying
 *     `IdentityProof` (signed by PApp at SSO V2 device-registration time)
 *     plus a single-element `senderDevices` list (this desktop). The inner
 *     and outer Statement Store proofs are signed by the device sr25519.
 *   - **Accept-signal watch** on the channel topic — sender side. When the
 *     peer accepts, we transition the local request state.
 *
 *   - **Receiving V2 chat requests**: enabled when the multi-device handshake
 *     delivered the user identity chat P-256 private key (carried on
 *     `userIdentity.identityChatPrivateKey`). Falls back to silent skip when
 *     paired with a legacy PApp build that didn't ship the priv-key extension.
 *
 * Out of scope (deferred to a follow-up):
 *   - **In-session V2 messaging**: needs the outer V1 pairwise
 *     `CommunicationEncryption` layer to wrap the multi-device envelope,
 *     and the V1 pairwise shared secret again derives from the user chat
 *     keypair. Receive of chat requests works without it; ongoing chat
 *     messaging does not.
 *   - **DeviceAdded/Removed handling** as chat-content variants on the active
 *     session — depends on in-session messaging working first.
 */

import { type Encryption, type LazyClient, type StatementStoreAdapter, createEncryption } from '@novasamatech/statement-store';
import { AccountId as AccountIdCodec } from '@polkadot-api/substrate-bindings';
import { nanoid } from 'nanoid';
import { fromHex, toHex } from 'polkadot-api/utils';
import { lastValueFrom } from 'rxjs';

import { environmentService, environmentUseCase } from '@/domains/application';
import { type Contact, type Device, contactRepository as defaultContactRepository } from '@/domains/contact';
import { type DeviceIdentity, type UserIdentity, isValidEncryptionPublicKey } from '@/domains/device';
// eslint-disable-next-line boundaries/dependencies -- chat needs the sibling-roster (own paired Hosts) to fan out deviceAdded to a new peer at accept time
import { deviceSyncRepository } from '@/domains/device-sync/repository';
import { type ChatMessage, type MessageContent } from '../session/types';

import {
  type AcceptSignal,
  type IdentityChannelEvent,
  postChatMessageOnDeviceChannel,
  postChatMessageOnIdentityChannel,
  subscribeToIdentityChannelV2,
} from './acceptSignalV2';
import { getCurrentDay } from './chatRequestTopics';
import { computePaginationTopicV2 } from './chatRequestTopicsV2';
import { type ValidatedRequestV2, sendChatRequestV2, subscribeToIncomingRequestsV2 } from './chatRequestV2';
import { type V2ChatPeerSession, createChatPeerSessionV2, isMessageTooLargeError } from './chatSessionV2';
import { mapSdkContent, mapUiContentToSdk } from './contentMappers';
import { computeSharedSecret } from './keys';
import { createPeerResolver } from './peerResolver';
import { sendPushNotification } from './pushNotification';
import { clearOutboxRecord, createOutboxStorage, p2pChatDatabase } from './repository';
import {
  createP2PMessage,
  createP2PRoom,
  deleteP2PMessage,
  deleteP2PMessages,
  deleteP2PRequest,
  deleteP2PRoom,
  markP2PMessagesAsRead,
  setP2PRoomBlocked,
  updateP2PMessageStatus,
  upsertP2PRequest,
} from './resource';
import { trackedSubscribeStatements } from './subscription-registry';
import { type P2PChatManager, type P2PChatRequest, type SearchResult } from './types';

export type P2PChatManagerV2Params = {
  statementStore: StatementStoreAdapter;
  lazyClient: LazyClient;
  userId: string;
  device: DeviceIdentity;
  userIdentity: UserIdentity;
  contactRepository?: typeof defaultContactRepository;
};

/**
 * Sibling rows safe to fan out to a peer as `deviceAdded`. A row whose enc
 * key is not a real P-256 point must never ship: mobile receivers store it
 * unvalidated and then fail their ENTIRE multi-device send when the key-wrap
 * for the bogus device throws (iOS `MultiDeviceEncodingError`). Rows like
 * that exist where host-papp 0.8.6's SSO shared secret was persisted as a
 * device key.
 */
async function listShippableSiblings(
  ownStmtAcctHex: string,
): Promise<{ statementAccountId: string; encryptionPublicKey: string }[]> {
  const siblings = await deviceSyncRepository.listActivePeers(ownStmtAcctHex).catch(() => []);

  return siblings.filter(sibling => {
    if (isValidEncryptionPublicKey(fromHex(sibling.encryptionPublicKey))) return true;
    console.warn(
      '[p2p-managerV2] sibling fanout: skipping sibling=%s — encryptionPublicKey is not a valid P-256 key',
      sibling.statementAccountId,
    );
    return false;
  });
}

export const createP2PChatManagerV2 = async (params: P2PChatManagerV2Params): Promise<P2PChatManager> => {
  const { statementStore, lazyClient, userId, device, userIdentity } = params;
  const contactRepository = params.contactRepository ?? defaultContactRepository;

  /**
   * Upsert the peer-side contact roster for V2 chat traffic.
   *
   * Each `Device` entry stores a peer device's `statementAccountId` (sr25519,
   * used as the `D(B)` input to SessionId derivation on incoming subscriptions
   * and as the `RequestDeviceInfo.statementAccountId` key in MultiRequest
   * envelopes) and `encryptionPublicKey` (P-256, used as the ECDH counterparty
   * in both the outer K(D(B),A) layer and the MultiDeviceRequest per-recipient
   * REQ_PK wrap).
   *
   * `peerDeviceStatementAccountIdHex` is the peer device sr25519. For incoming
   * V2 chat requests, it is `RemoteModel.proof.signer` (taken from
   * `ValidatedRequestV2.senderDeviceStatementAccountId`); for `DeviceAdded`
   * fan-out on the identity channel, it comes from `DeviceInfo.statementAccountId`.
   * `proof.signer == device statementAccountId` is forced by IdentityProof
   * verification — the verifier hashes `IdentityProofPayload { ...,
   * statementAccountId: proof.signer, ... }` against K(B,A) and rejects on
   * mismatch — so any V2 chat request that decoded successfully carries the
   * peer's real device sr25519. Identity-conflated fallback (using the peer's
   * identity sr25519 as the device id) survives only for the
   * `markOutgoingRequestAccepted` path where the device pubkey is not yet known.
   *
   * Dedup runs on BOTH `statementAccountId` and `encryptionPublicKey` so a
   * later `DeviceAdded` carrying the same `encryptionPublicKey` replaces a
   * conflated entry rather than duplicating it.
   */
  const upsertContactWithDevice = async (
    peerAccountIdSs58: string,
    peerIdentityChatPublicKeyHex: string,
    peerDevicePubKeyHex: string | undefined,
    peerDeviceStatementAccountIdHex?: string,
  ): Promise<void> => {
    try {
      const existing = await contactRepository.get(peerAccountIdSs58);
      const peerIdentityAccountIdHex = toHex(AccountIdCodec().enc(peerAccountIdSs58));
      const effectiveStatementAccountIdHex = peerDeviceStatementAccountIdHex ?? peerIdentityAccountIdHex;
      // Wire data (request signer / deviceAdded payload) — drop devices whose
      // enc key is not a real P-256 point instead of persisting them. One bad
      // roster entry breaks every outgoing MultiRequest to this contact (the
      // per-device key wrap throws and the whole send fails).
      const hasValidDeviceKey = peerDevicePubKeyHex !== undefined && isValidEncryptionPublicKey(fromHex(peerDevicePubKeyHex));
      if (peerDevicePubKeyHex !== undefined && !hasValidDeviceKey) {
        console.warn(
          '[p2p-managerV2] upsertContactWithDevice: dropping device=%s for peer=%s — encryptionPublicKey is not a valid P-256 key',
          effectiveStatementAccountIdHex,
          peerAccountIdSs58,
        );
      }
      const incomingDevice: Device | undefined = hasValidDeviceKey
        ? {
            statementAccountId: effectiveStatementAccountIdHex,
            encryptionPublicKey: peerDevicePubKeyHex,
          }
        : undefined;
      if (existing === undefined) {
        // contactRepository.upsert auto-fills lastUpdate when omitted.
        await contactRepository.upsert({
          accountId: peerAccountIdSs58,
          identityChatPublicKey: peerIdentityChatPublicKeyHex,
          devices: incomingDevice ? [incomingDevice] : [],
        });
        return;
      }
      const without = incomingDevice
        ? existing.devices.filter(
            d =>
              d.statementAccountId !== incomingDevice.statementAccountId &&
              d.encryptionPublicKey !== incomingDevice.encryptionPublicKey,
          )
        : existing.devices;
      const merged: Contact = {
        ...existing,
        // Preserve the existing chat key when the new lookup came back empty
        // (chain RPC blip at accept time would otherwise wipe a previously
        // resolved key and break startSession on the next attempt).
        identityChatPublicKey: peerIdentityChatPublicKeyHex || existing.identityChatPublicKey,
        devices: incomingDevice ? [...without, incomingDevice] : existing.devices,
        // Bump lastUpdate so device-sync's collector re-picks the contact on
        // the next pump. Critical for the "Desktop sends request → peer
        // accepts" flow: the contact was created (and its `lastUpdate` stamped)
        // at sendRequest time, filtered out of `ChatsAdded` by
        // `isContactSyncable` (pending request), and the checkpoint advanced
        // past it. Without this bump, accept doesn't change `lastUpdate`,
        // `listChangedSince(checkpoint)` returns empty, and siblings never
        // see the accepted chat. Applies symmetrically to deviceAdded /
        // chat-key updates that pass through this merge path.
        lastUpdate: Date.now(),
      };
      await contactRepository.upsert(merged);
    } catch {
      // non-fatal
    }
  };

  const resolver = await createPeerResolver(lazyClient, environmentService.getActiveId());
  const seenMessageIds = new Set<string>();
  const seenRequestIds = new Set<string>();
  const activeSessions = new Map<string, V2ChatPeerSession>();

  // Per-peer push context — sharedSecret/encryption are user-level (derived
  // from our user identityChatPrivateKey × peer identityChatPublicKey), so all
  // devices on either side compute the same secret. The mobile receiver uses
  // this same secret to decrypt and to derive `pushId`.
  type V2PushContext = {
    sharedSecret: Uint8Array;
    encryption: Encryption;
    ownAccountId: Uint8Array;
    peerAccountId: Uint8Array;
  };
  const pushContexts = new Map<string, V2PushContext>();
  // Dedupe push sends per (peer, messageId) so retries / multi-session
  // re-entries don't spam the backend. Mirrors V1's `pushNotifiedIds`.
  const pushNotifiedIds = new Set<string>();
  const ownAccountIdBytes = AccountIdCodec().enc(userId);

  // One long-running subscription per known peer on the identity-level topic
  // `SessionId(A,B)` with outer key `K(A,B)`. Surfaces both bootstrap events
  // (accept signals from outgoing chat requests) and steady-state events
  // (DeviceAdded/DeviceRemoved fan-out from peer's PApp). Keyed by peer SS58.
  const identityChannelUnsubs = new Map<string, VoidFunction>();

  // Per-pending-outgoing-request matchers. The identity-channel listener
  // dispatches acceptSignal events to whichever matcher is registered for the
  // signal's `requestId`. Matchers remove themselves on first match — the
  // underlying subscription stays open (long-running) for future roster events.
  type AcceptMatcher = (signal: AcceptSignal) => void;
  const pendingAcceptMatchers = new Map<string, AcceptMatcher>();

  let requestUnsub: VoidFunction | null = null;
  let disposed = false;
  let ready = false;

  // ── Helpers ──────────────────────────────────────────────────────────────

  const writeMessage = async (message: ChatMessage) => {
    await lastValueFrom(createP2PMessage(message));
  };

  const writeRequest = async (request: P2PChatRequest) => {
    await lastValueFrom(upsertP2PRequest(request));
  };

  /**
   * A message was first carried by a successfully submitted statement —
   * immediately for normal sends, at drain time for parked ones (possibly in
   * a later app run). Owns the `new → sent` flip and the push notification;
   * `sendMessage` no longer does either inline, so parked messages get both
   * exactly when they actually hit the wire.
   */
  const handleMessageSent = async (peerId: string, messageId: string) => {
    // onSent fires exactly once per message, so a swallowed failure here
    // permanently skips the flip + push — log it instead of conflating a
    // transient DB error with the legitimate no-row case (e.g. `leftChat`).
    const row = await p2pChatDatabase.messages.get(messageId).catch(err => {
      console.warn('[p2p-managerV2] onSent: message read failed for %s — sent flip skipped: %o', messageId, err);
      return undefined;
    });
    // Only act from `new`: an ACK can outrun this handler (row already
    // `delivered` — don't regress it), and sends without a Dexie row
    // (e.g. `leftChat`) have nothing to flip or push.
    if (!row || row.status.direction !== 'outgoing' || row.status.state !== 'new') return;

    await lastValueFrom(
      updateP2PMessageStatus({ messageId, sessionId: peerId, status: { direction: 'outgoing', state: 'sent' } }),
    ).catch(err => {
      console.warn('[p2p-managerV2] onSent: new→sent flip failed for %s: %o', messageId, err);
    });

    const pushCtx = pushContexts.get(peerId);
    if (!pushCtx || pushNotifiedIds.has(messageId)) return;
    pushNotifiedIds.add(messageId);
    const sdkContent = mapUiContentToSdk(row.content);
    if (!sdkContent) return;
    const room = await p2pChatDatabase.rooms
      .where('peerId')
      .equals(peerId)
      .first()
      .catch(() => undefined);
    if (!room?.peerPushToken) return;
    await sendPushNotification({
      deviceToken: room.peerPushToken,
      peerPlatform: room.peerPlatform,
      sharedSecret: pushCtx.sharedSecret,
      encryption: pushCtx.encryption,
      localAccountId: pushCtx.ownAccountId,
      remoteAccountId: pushCtx.peerAccountId,
      messageId,
      timestamp: row.timestamp,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- mapUiContentToSdk widens to {tag,value}; the push codec narrows on encode
      content: sdkContent as any,
      environmentId: environmentService.getActiveId(),
    }).catch(() => {});
  };

  const recreateSessionForPeer = async (peerSs58: string) => {
    const sess = activeSessions.get(peerSs58);
    if (sess) {
      sess.dispose();
      activeSessions.delete(peerSs58);
    }
    const room = await p2pChatDatabase.rooms.where('peerId').equals(peerSs58).first();
    if (!room) return;
    await manager.startSession(peerSs58, room.peerUsername ?? peerSs58).catch(() => {});
  };

  // ── Identity-channel listener (per-peer, long-running) ──────────────────

  const onIdentityChannelEvent = async (peerSs58: string, event: IdentityChannelEvent) => {
    console.info(
      '[p2p-managerV2] identity-channel event peer=%s tag=%s%s',
      peerSs58,
      event.tag,
      event.tag === 'acceptSignal'
        ? ` requestId=${event.signal.requestId} hasAcceptorDevice=${event.signal.acceptorDevice ? 'yes' : 'no'}`
        : '',
    );
    if (event.tag === 'acceptSignal') {
      const matcher = pendingAcceptMatchers.get(event.signal.requestId);
      if (matcher) {
        matcher(event.signal);
        return;
      }

      // No matcher = another sibling paired device sent this request. We
      // still want to (a) populate our local `Contact(peer).devices` so
      // V2 sends work after we navigate to the chat, (b) persist a
      // `deviceChatAccepted` chat-message row so future device-sync from
      // *this* desktop carries the acceptor's device info to its own
      // siblings (and to itself after a clean reinstall). Mirror of the
      // matcher-side persistence.
      console.info(
        '[p2p-managerV2] identity-channel acceptSignal: no matcher for requestId=%s (peer=%s) — applying locally',
        event.signal.requestId,
        peerSs58,
      );
      if (event.signal.acceptorDevice) {
        const acceptorDevice = event.signal.acceptorDevice;
        await upsertContactWithDevice(
          peerSs58,
          '', // preserve existing chat-key
          toHex(acceptorDevice.encryptionPublicKey),
          toHex(acceptorDevice.statementAccountId),
        );
        // Flip the local outgoing-request row (if any) — sibling may have
        // already created it during its sync of our send, in which case we
        // want the UI on both sides to converge.
        const existingReq = await p2pChatDatabase.requests.get(event.signal.requestId);
        if (existingReq && existingReq.status === 'pending') {
          await p2pChatDatabase.requests.update(event.signal.requestId, {
            status: 'accepted',
            lastUpdate: Date.now(),
          });
        }
        // Persist row for sync replication.
        const dcaId = `device-chat-accepted:${event.signal.requestId}`;
        const existingRow = await p2pChatDatabase.messages.get(dcaId);
        if (!existingRow) {
          const dcaMsg: ChatMessage = {
            messageId: dcaId,
            sessionId: peerSs58,
            peer: { type: 'p2p', accountId: peerSs58, name: peerSs58 },
            timestamp: event.signal.acceptedAt,
            content: {
              type: 'deviceChatAccepted',
              requestId: event.signal.requestId,
              statementAccountId: toHex(acceptorDevice.statementAccountId),
              encryptionPublicKey: toHex(acceptorDevice.encryptionPublicKey),
            },
            status: { direction: 'incoming', state: 'seen' },
          };
          seenMessageIds.add(dcaMsg.messageId);
          await writeMessage(dcaMsg).catch(() => {});
        }
        // Mirror the matcher path: surface a `contactAdded` system row so the
        // UI renders "Accepted the request" on this device too. The
        // `deviceChatAccepted` row above is filtered out of every visible
        // surface (`chatMessageService.isSyncCarrier`); only `contactAdded`
        // triggers the system bubble in MessageFlow.
        const acceptedId = `req-accepted:${event.signal.requestId}`;
        const existingAccepted = await p2pChatDatabase.messages.get(acceptedId);
        if (!existingAccepted) {
          const acceptedMsg: ChatMessage = {
            messageId: acceptedId,
            sessionId: peerSs58,
            peer: { type: 'p2p', accountId: peerSs58, name: peerSs58 },
            timestamp: event.signal.acceptedAt,
            content: { type: 'contactAdded' },
            status: { direction: 'incoming', state: 'seen' },
          };
          seenMessageIds.add(acceptedMsg.messageId);
          await writeMessage(acceptedMsg).catch(() => {});
        }
        await recreateSessionForPeer(peerSs58);
      }
      return;
    }

    if (event.tag === 'deviceAdded') {
      const statementAccountIdHex = toHex(event.statementAccountId);
      const encryptionPublicKeyHex = toHex(event.encryptionPublicKey);
      await upsertContactWithDevice(peerSs58, '' /* no chat-key update */, encryptionPublicKeyHex, statementAccountIdHex);
      // Propagate the learned peer device to our sibling paired devices: persist
      // a `deviceAdded` chat-message row so device-sync replicates it via the
      // `Messages` entity, where the applier re-adds it to `Contact(peer).devices`.
      // Without this, a sibling that didn't see this identity-channel fan-out
      // never learns the peer device and silently drops its MultiRequests.
      // Mirrors the `deviceChatAccepted` persistence in the accept path.
      const daId = `device-added:${peerSs58}:${statementAccountIdHex}`;
      const existingDaRow = await p2pChatDatabase.messages.get(daId);
      if (!existingDaRow) {
        const daMsg: ChatMessage = {
          messageId: daId,
          sessionId: peerSs58,
          peer: { type: 'p2p', accountId: peerSs58, name: peerSs58 },
          timestamp: Date.now(),
          content: {
            type: 'deviceAdded',
            statementAccountId: statementAccountIdHex,
            encryptionPublicKey: encryptionPublicKeyHex,
          },
          status: { direction: 'incoming', state: 'seen' },
        };
        seenMessageIds.add(daMsg.messageId);
        await writeMessage(daMsg).catch(() => {});
      }
      await recreateSessionForPeer(peerSs58);
      return;
    }

    if (event.tag === 'deviceRemoved') {
      const removedHex = toHex(event.statementAccountId);
      const existing = await contactRepository.get(peerSs58);
      if (existing) {
        await contactRepository.upsert({
          ...existing,
          devices: existing.devices.filter(d => d.statementAccountId !== removedHex),
        });
      }
      await recreateSessionForPeer(peerSs58);
    }
  };

  const startIdentityChannelListener = (
    peerSs58: string,
    peerIdentityAccountId: Uint8Array,
    peerIdentityChatPublicKey: Uint8Array,
  ): void => {
    if (identityChannelUnsubs.has(peerSs58)) {
      console.info('[p2p-managerV2] identity-channel listener already running peer=%s', peerSs58);
      return;
    }
    if (!userIdentity.identityChatPrivateKey) {
      console.warn('[p2p-managerV2] identity-channel listener: cannot start for peer=%s — no identityChatPrivateKey', peerSs58);
      return;
    }
    console.info(
      '[p2p-managerV2] identity-channel listener: starting peer=%s peerChatPubKey=%s',
      peerSs58,
      toHex(peerIdentityChatPublicKey).slice(0, 18) + '…',
    );

    const unsub = subscribeToIdentityChannelV2(
      {
        ownIdentityChatPrivateKey: userIdentity.identityChatPrivateKey,
        ownIdentityAccountId: userIdentity.identitySr25519PublicKey,
        peerIdentityChatPublicKey,
        peerIdentityAccountId,
        ownDeviceStatementAccountId: device.statementAccountPublicKey,
        ownDeviceEncryptionPrivateKey: device.encryptionPrivateKey,
        statementStore,
      },
      event => {
        void onIdentityChannelEvent(peerSs58, event);
      },
    );
    identityChannelUnsubs.set(peerSs58, unsub);
  };

  // ── Accept-signal watcher (sender side, one-shot per requestId) ─────────

  const watchForAcceptSignalV2 = (
    requestId: string,
    peerIdentityAccountId: Uint8Array,
    peerIdentityChatPublicKey: Uint8Array,
    peerAccountId: string,
    peerUsername: string,
    welcomeMessage?: string,
  ) => {
    if (pendingAcceptMatchers.has(requestId)) {
      console.info('[p2p-managerV2] watchForAcceptSignalV2: matcher already armed requestId=%s', requestId);
      return;
    }
    if (!userIdentity.identityChatPrivateKey) {
      console.warn(
        '[p2p-managerV2] watchForAcceptSignalV2: no identityChatPrivateKey, cannot arm matcher requestId=%s',
        requestId,
      );
      return;
    }

    console.info('[p2p-managerV2] watchForAcceptSignalV2: arming matcher requestId=%s peer=%s', requestId, peerAccountId);

    // Identity-channel listener is shared across requests/roster events for
    // this peer. Start it if we don't already have one running.
    startIdentityChannelListener(peerAccountId, peerIdentityAccountId, peerIdentityChatPublicKey);

    pendingAcceptMatchers.set(requestId, async signal => {
      pendingAcceptMatchers.delete(requestId);
      console.info(
        '[p2p-managerV2] matcher fired requestId=%s peer=%s hasAcceptorDevice=%s',
        requestId,
        peerAccountId,
        signal.acceptorDevice ? 'yes' : 'no',
      );

      // Per chat spec, only `deviceChatAccepted @20` carrying the acceptor's
      // real `DeviceInfo` is honored. Android-legacy `chatAccepted @14` is
      // dropped at the decoder (acceptSignalV2.decodeEventsFromChatMessage)
      // so we never see `acceptorDevice === null` here. If we ever do, log
      // and bail — better to leave the request 'pending' than to forge a
      // synthetic identity-conflated device that would silently break sends.
      if (!signal.acceptorDevice) {
        console.warn(
          '[p2p-managerV2] acceptSignal without acceptorDevice (requestId=%s peer=%s) — dropping',
          requestId,
          peerAccountId,
        );
        return;
      }
      const acceptorDevice = signal.acceptorDevice;
      const realDeviceStatementAccountIdHex = toHex(signal.acceptorDevice.statementAccountId);

      // Flip the request to 'accepted' FIRST and AWAIT — symmetric with the
      // acceptRequest fix (2b5b8059). The contact upsert below emits a
      // signalLocalChange and starts the 50ms audit-pump window; if the request
      // is still 'pending' when the pump fires, isContactSyncable returns false
      // and the contact is filtered out of ChatsAdded. requests.update doesn't
      // trigger signalLocalChange so doing it first doesn't add a premature
      // pump. Awaiting makes the subsequent contact upsert's pump see the
      // accepted state, so ChatsAdded fires on first try (no race).
      await p2pChatDatabase.requests.update(requestId, { status: 'accepted' }).catch(() => {});

      // Now upsert the contact with the new device — this emits the signal
      // that opens the audit window. Await so the contact write happens
      // before any subsequent message writes (which also emit signals and
      // could otherwise interleave with this one).
      await upsertContactWithDevice(
        peerAccountId,
        toHex(peerIdentityChatPublicKey),
        toHex(acceptorDevice.encryptionPublicKey),
        realDeviceStatementAccountIdHex,
      ).catch(() => {});
      // Fire-and-forget startSession — needs the contact-roster to exist (above),
      // but doesn't need to complete before the audit pump.
      void manager.startSession(peerAccountId, peerUsername).catch(() => {});

      // Persist `deviceChatAccepted` as a chat-message row so device-sync
      // collector picks it up and replicates the acceptor's device info to
      // this user's other paired devices. Without this, a sibling desktop
      // that learns about the chat only via `ChatsAdded` would never know
      // the peer's device and would be stuck at the V2 startSession gate
      // (`contact.devices.length === 0` → throws). The row is filtered out of
      // every visible surface via `chatMessageService.isSyncCarrier`.
      // Skipped when `signal.acceptorDevice` is null (Android-legacy
      // `chatAccepted @14` path) — nothing concrete to share.
      //
      // Stamp accept rows with the acceptor's own `acceptedAt`, not local wall
      // time: on a restart re-apply (or sibling replay) `Date.now()` would sort
      // the event after the real conversation, surfacing "accepted the request"
      // at the end of the chat on every device it syncs to.
      if (signal.acceptorDevice) {
        const deviceStmtAcctHex = toHex(signal.acceptorDevice.statementAccountId);
        const deviceEncPubHex = toHex(signal.acceptorDevice.encryptionPublicKey);
        console.info(
          '[DEVICE-TRACE] matcher WRITE deviceChatAccepted row for sibling-MDS:\n  dcaId=device-chat-accepted:%s\n  peerId(B)=%s\n  contained device.stmtAcct=%s (B device, from acceptSignal)\n  contained device.encPub=%s',
          requestId,
          peerAccountId,
          deviceStmtAcctHex,
          deviceEncPubHex,
        );
        const dcaMsg: ChatMessage = {
          messageId: `device-chat-accepted:${requestId}`,
          sessionId: peerAccountId,
          peer: { type: 'p2p', accountId: peerAccountId, name: peerAccountId },
          timestamp: signal.acceptedAt,
          content: {
            type: 'deviceChatAccepted',
            requestId,
            statementAccountId: deviceStmtAcctHex,
            encryptionPublicKey: deviceEncPubHex,
          },
          status: { direction: 'incoming', state: 'seen' },
        };
        seenMessageIds.add(dcaMsg.messageId);
        await writeMessage(dcaMsg).catch(() => {});

        // Also persist a `deviceAdded` row symmetrically with acceptRequest's
        // producer side (`:951-970`). Mobile appliers that only handle the
        // `deviceAdded` content tag — not `deviceChatAccepted` — still get the
        // peer's device roster updated on the sibling. Desktop appliers
        // dedupe by statementAccountId, so receiving both tags is idempotent.
        console.info(
          '[DEVICE-TRACE] matcher WRITE peer-device row for sibling-MDS:\n  daId=device-added:%s:%s\n  peerId(B)=%s\n  contained device.stmtAcct=%s (B device)\n  contained device.encPub=%s',
          peerAccountId,
          deviceStmtAcctHex,
          peerAccountId,
          deviceStmtAcctHex,
          deviceEncPubHex,
        );
        const daMsg: ChatMessage = {
          messageId: `device-added:${peerAccountId}:${deviceStmtAcctHex}`,
          sessionId: peerAccountId,
          peer: { type: 'p2p', accountId: peerAccountId, name: peerAccountId },
          timestamp: signal.acceptedAt,
          content: {
            type: 'deviceAdded',
            statementAccountId: deviceStmtAcctHex,
            encryptionPublicKey: deviceEncPubHex,
          },
          status: { direction: 'incoming', state: 'seen' },
        };
        seenMessageIds.add(daMsg.messageId);
        await writeMessage(daMsg).catch(() => {});
      }

      // Surface a system-style chat message so the UI reflects the accepted state.
      const acceptedMsg: ChatMessage = {
        messageId: `req-accepted:${requestId}`,
        sessionId: peerAccountId,
        peer: { type: 'p2p', accountId: peerAccountId, name: peerAccountId },
        timestamp: signal.acceptedAt,
        content: { type: 'contactAdded' },
        status: { direction: 'incoming', state: 'seen' },
      };
      seenMessageIds.add(acceptedMsg.messageId);
      await writeMessage(acceptedMsg).catch(() => {});

      // Fan out `deviceAdded` for each of A's other paired Hosts to B via
      // identity-channel. B's `Contact(A).devices` so far only contains THIS
      // desktop's device (extracted from the original request's signer); when
      // A_mobile or another sibling later sends a multi-device envelope to B,
      // B sees an unknown signer and drops it. Symmetric with acceptRequest's
      // sibling fanout below — same code path, just triggered from the
      // matcher side.
      if (userIdentity.identityChatPrivateKey) {
        const ownStmtAcctHex = toHex(device.statementAccountPublicKey);
        void (async () => {
          const siblings = await listShippableSiblings(ownStmtAcctHex);
          console.info(
            '[DEVICE-TRACE] matcher FANOUT START: %d sibling(s) to ship to peer=%s on device-channel; siblings=%o',
            siblings.length,
            peerAccountId,
            siblings.map(s => ({ stmtAcct: s.statementAccountId, encPub: s.encryptionPublicKey })),
          );
          for (const sibling of siblings) {
            console.info(
              '[DEVICE-TRACE] matcher FANOUT one sibling -> peer:\n  peerId(B)=%s\n  carrying SIBLING.stmtAcct=%s\n  carrying SIBLING.encPub=%s',
              peerAccountId,
              sibling.statementAccountId,
              sibling.encryptionPublicKey,
            );
            // Use device-channel for sibling roster fanout — matches mobile
            // semantics (Android `communicationSessions.main`, iOS per-peer-device
            // subscription). Bootstrap `deviceChatAccepted` is what mobile uses
            // to learn our device; after that they listen on per-device topics,
            // not the identity-channel.
            await postChatMessageOnDeviceChannel({
              ownIdentityChatPrivateKey: userIdentity.identityChatPrivateKey!,
              peerIdentityAccountId,
              peerIdentityChatPublicKey,
              peerDeviceEncryptionPublicKey: acceptorDevice.encryptionPublicKey,
              ownDeviceStatementAccountId: device.statementAccountPublicKey,
              ownDeviceEncryptionPrivateKey: device.encryptionPrivateKey,
              signerDeviceSeed: device.statementAccountSeed,
              statementStore,
              chatMessageContent: {
                tag: 'deviceAdded',
                value: {
                  statementAccountId: fromHex(sibling.statementAccountId),
                  encryptionPublicKey: fromHex(sibling.encryptionPublicKey),
                },
              },
            }).catch(err =>
              console.warn(
                '[p2p-managerV2] matcher fanout: post sibling deviceAdded failed sibling=%s: %s',
                sibling.statementAccountId,
                err,
              ),
            );
          }
        })();
      }

      // The chat-request's inner message IS the welcome message; its canonical
      // ID is the requestId so reaction targets stay aligned with android/iOS.
      // Without this write the sender never sees their own welcome message in
      // the room they navigated into right after `sendRequest`.
      if (welcomeMessage) {
        seenMessageIds.add(requestId);
        writeMessage({
          messageId: requestId,
          sessionId: peerAccountId,
          peer: { type: 'p2p', accountId: userId, name: '' },
          // Sent just before the peer accepted — keep it ordered right before
          // the accept event rather than at local wall time.
          timestamp: signal.acceptedAt - 1,
          content: { type: 'text', text: welcomeMessage },
          status: { direction: 'outgoing', state: 'delivered' },
        }).catch(() => {});
      }
    });
  };

  // ── Incoming request handler ────────────────────────────────────────────

  const isV2Validated = (r: object): r is ValidatedRequestV2 =>
    'senderDevicePubKey' in r && r.senderDevicePubKey instanceof Uint8Array;

  const addIncomingRequest: Parameters<typeof subscribeToIncomingRequestsV2>[1] = validated => {
    if (seenRequestIds.has(validated.requestId)) {
      console.info('[p2p-managerV2] addIncomingRequest: dup requestId=%s (in-memory seen), skipping', validated.requestId);
      return;
    }
    seenRequestIds.add(validated.requestId);

    // For V2 the upstream decoder rewrites `senderAccountId` to the user
    // identity (so contact resolution lands on the user, not the device).
    const senderAccountIdStr = AccountIdCodec().dec(validated.senderAccountId);
    console.info(
      '[p2p-managerV2] addIncomingRequest: requestId=%s peer=%s welcome=%s isV2=%s senderDevicePub=%s',
      validated.requestId,
      senderAccountIdStr,
      validated.welcomeMessage
        ? `"${validated.welcomeMessage.slice(0, 40)}${validated.welcomeMessage.length > 40 ? '…' : ''}"`
        : '(none)',
      isV2Validated(validated) ? 'yes' : 'no',
      isV2Validated(validated) ? toHex(validated.senderDevicePubKey).slice(0, 18) + '…' : '(V1, no devicePubKey)',
    );

    // Persistent dedup. The in-memory `seenRequestIds` set is wiped on every
    // manager re-init; without a Dexie-level check, a stale on-chain request
    // (from a previous round the user has already removed via `removeSession`)
    // would resurface as a fresh incoming after each reload. We keep tombstones
    // ('removed' status) so subsequent sightings of the same requestId are
    // silently ignored.
    void (async () => {
      const existing = await p2pChatDatabase.requests.get(validated.requestId);
      if (existing) return;

      // Mirrors Android's BlockedContactsRepository — drop incoming requests from
      // peers the user has blocked. Block state lives on the existing room row.
      const room = await p2pChatDatabase.rooms.where('peerId').equals(senderAccountIdStr).first();
      if (room?.isBlocked) return;

      const newRequest: P2PChatRequest = {
        requestId: validated.requestId,
        peerId: senderAccountIdStr,
        direction: 'incoming',
        status: 'pending',
        welcomeMessage: validated.welcomeMessage,
        timestamp: validated.timestamp,
        channelTopic: validated.channelTopic,
        userId,
        pushToken: validated.pushToken,
        pushPlatform: validated.pushPlatform,
        senderDevicePubKey: isV2Validated(validated) ? toHex(validated.senderDevicePubKey) : undefined,
        senderDeviceStatementAccountId: isV2Validated(validated) ? toHex(validated.senderDeviceStatementAccountId) : undefined,
        lastUpdate: Date.now(),
      };

      await writeRequest(newRequest);
    })();

    resolver
      .getUsername(senderAccountIdStr)
      .then(username => {
        if (username) {
          p2pChatDatabase.requests.update(validated.requestId, { peerUsername: username }).catch(() => {});
        }
      })
      .catch(() => {});
  };

  // ── Manager object ──────────────────────────────────────────────────────

  const manager: P2PChatManager = {
    get isReady() {
      return ready;
    },

    async searchPeers(query: string): Promise<SearchResult[]> {
      return resolver.searchUsers(query);
    },

    async startSession(peerId: string, peerUsername: string) {
      if (disposed) return;
      if (activeSessions.has(peerId)) return;
      if (!userIdentity.identityChatPrivateKey) {
        throw new Error(
          '[p2p-managerV2] cannot start V2 session: no identityChatPrivateKey persisted. Re-pair against a multi-device PApp.',
        );
      }

      let contact = await contactRepository.get(peerId);
      if (!contact) {
        throw new Error(`[p2p-managerV2] cannot start session: contact ${peerId} not in roster yet`);
      }
      if (!contact.identityChatPublicKey) {
        throw new Error(`[p2p-managerV2] cannot start session: contact ${peerId} has no identityChatPublicKey`);
      }
      if (contact.devices.length === 0) {
        // Self-heal a device-less roster from a local incoming request row. The
        // Desktop receives the peer's chat request directly (both siblings
        // subscribe to the incoming-requests topic), so the request carries the
        // peer device key (`senderDevicePubKey` + `senderDeviceStatementAccountId`).
        // The ChatsAdded sync auto-accept path (sibling accepted) creates the
        // contact device-less; the applier now copies the key forward, but a
        // contact persisted before that fix — or any future propagation gap —
        // would otherwise stay permanently stuck here. Recover from the request
        // row (same data `acceptRequest` uses) before giving up.
        const recoverable = await p2pChatDatabase.requests
          .where('peerId')
          .equals(peerId)
          .filter(r => r.direction === 'incoming' && !!r.senderDevicePubKey)
          .toArray();
        const withDevice = recoverable.find(r => r.senderDevicePubKey);
        if (withDevice?.senderDevicePubKey) {
          await upsertContactWithDevice(
            peerId,
            contact.identityChatPublicKey,
            withDevice.senderDevicePubKey,
            withDevice.senderDeviceStatementAccountId,
          ).catch(() => {});
          contact = (await contactRepository.get(peerId)) ?? contact;
        }
      }
      if (contact.devices.length === 0) {
        throw new Error(
          `[p2p-managerV2] cannot start session: peer ${peerId} device topology unknown — they need to send a chat request or message first`,
        );
      }

      const peerAccountIdBytes = AccountIdCodec().enc(peerId);
      const peerIdentityChatPubKey = fromHex(contact.identityChatPublicKey);
      const peerDevices = contact.devices.map(d => ({
        statementAccountId: fromHex(d.statementAccountId),
        encryptionPublicKey: fromHex(d.encryptionPublicKey),
      }));

      // User-level shared secret used for outgoing push-notification encryption
      // + pushId derivation. Same on every device of either user, so the mobile
      // receiver derives an identical secret regardless of which sibling sent.
      const pushSharedSecret = computeSharedSecret(userIdentity.identityChatPrivateKey, peerIdentityChatPubKey);
      pushContexts.set(peerId, {
        sharedSecret: pushSharedSecret,
        encryption: createEncryption(pushSharedSecret),
        ownAccountId: ownAccountIdBytes,
        peerAccountId: peerAccountIdBytes,
      });

      const peer = { type: 'p2p' as const, accountId: peerId, name: peerUsername };

      const session = createChatPeerSessionV2({
        identityChatPrivateKey: userIdentity.identityChatPrivateKey,
        ownIdentityAccountId: userIdentity.identitySr25519PublicKey,
        ownDeviceStatementAccountId: device.statementAccountPublicKey,
        ownDeviceEncryptionPrivateKey: device.encryptionPrivateKey,
        ownDeviceSeed: device.statementAccountSeed,
        peerIdentityAccountId: peerAccountIdBytes,
        peerIdentityChatPublicKey: peerIdentityChatPubKey,
        peerDevices,
        statementStore,
        onMessage: ({ messageId, timestamp, content }) => {
          if (seenMessageIds.has(messageId)) return;
          seenMessageIds.add(messageId);

          // Push token from peer — persist on Room for outgoing notifications, don't display.
          // `iOSVoIP` tokens are for CallKit wake-ups; desktop never initiates calls
          // (no dataChannelOffer producer), so they're useless here — drop them so they
          // don't overwrite the regular `'Android' | 'iOS'` value on `peerPlatform`.
          if (content.tag === 'token') {
            const tokenValue = content.value;
            const platform = tokenValue.platform;
            if (platform !== 'Android' && platform !== 'iOS') return;
            const tokenHex = typeof tokenValue.token === 'string' ? tokenValue.token.replace(/^0x/, '') : '';
            if (tokenHex) {
              p2pChatDatabase.rooms
                .where('peerId')
                .equals(peerId)
                .modify({ peerPushToken: tokenHex, peerPlatform: platform })
                .catch(() => {});
            }
            return;
          }

          // The accept-signal listener (`subscribeToAcceptSignalV2`) is the
          // authoritative consumer of `chatAccepted` (Android legacy) and
          // `deviceChatAccepted` (spec / iOS). Sessions only run post-bootstrap,
          // so any accept reaching this callback has already been processed
          // upstream — drop it to avoid duplicate "contactAdded" system rows.
          //   TODO(android-migrate): remove the `chatAccepted` branch when
          //   Android emits `deviceChatAccepted @20` exclusively.
          if (content.tag === 'chatAccepted' || content.tag === 'deviceChatAccepted') return;

          // Device roster mutations (V2 multi-device) — apply to peer Contact.
          if (content.tag === 'deviceAdded') {
            const { statementAccountId, encryptionPublicKey } = content.value;
            void contactRepository.get(peerId).then(existing => {
              if (!existing) return;
              const incoming: Device = {
                statementAccountId: toHex(statementAccountId),
                encryptionPublicKey: toHex(encryptionPublicKey),
              };
              const without = existing.devices.filter(d => d.statementAccountId !== incoming.statementAccountId);
              return contactRepository.upsert({ ...existing, devices: [...without, incoming] });
            });
            const sess = activeSessions.get(peerId);
            if (sess) {
              sess.dispose();
              activeSessions.delete(peerId);
            }
            return;
          }

          if (content.tag === 'deviceRemoved') {
            const { statementAccountId } = content.value;
            const removedHex = toHex(statementAccountId);
            void contactRepository.get(peerId).then(existing => {
              if (!existing) return;
              return contactRepository.upsert({
                ...existing,
                devices: existing.devices.filter(d => d.statementAccountId !== removedHex),
              });
            });
            const sess = activeSessions.get(peerId);
            if (sess) {
              sess.dispose();
              activeSessions.delete(peerId);
            }
            return;
          }

          const mapped = mapSdkContent(content);
          if (!mapped) return;

          const newMsg: ChatMessage = {
            messageId,
            sessionId: peerId,
            peer,
            timestamp,
            content: mapped,
            status: { direction: 'incoming', state: 'new' },
          };
          writeMessage(newMsg).catch(() => {});
        },
        onDelivered: messageId => {
          // Peer acked one of our sent messages → advance outgoing sent →
          // delivered (✓✓). The session only fires this for messages it tracked
          // (our own outgoing), and the optimistic write in `sendMessage`
          // guarantees the row already exists; a no-op if it was since deleted.
          void lastValueFrom(
            updateP2PMessageStatus({ messageId, sessionId: peerId, status: { direction: 'outgoing', state: 'delivered' } }),
          ).catch(() => {});
        },
        onSent: messageId => {
          void handleMessageSent(peerId, messageId);
        },
        onUndeliverable: messageId => {
          // A parked message can no longer fit any statement (the peer's
          // roster grew since it parked) — same outcome as a
          // MessageTooLargeError-rejected send: remove the optimistic row
          // instead of leaving a forever-`new` clock behind a dead queue.
          seenMessageIds.delete(messageId);
          void lastValueFrom(deleteP2PMessage({ messageId })).catch(() => {});
        },
        outbox: createOutboxStorage(userId, peerId),
      });

      activeSessions.set(peerId, session);
    },

    async removeSession(peerId: string) {
      // Notify the peer we've left so their UI can mark the chat as departed
      // (android consumes `ChatMessage.Content.LeftChat`). Best-effort: if
      // the session isn't active, try to spin one up; if that fails (peer
      // device topology unknown / chat key not yet on chain) we proceed with
      // the local teardown anyway — the only cost is the peer doesn't see
      // the leave indicator. This must happen BEFORE dispose() so the send
      // actually goes out on the wire.
      try {
        let session = activeSessions.get(peerId);
        if (!session) {
          const room = await p2pChatDatabase.rooms.where('peerId').equals(peerId).first();
          const peerUsername = room?.peerUsername ?? peerId;
          await this.startSession(peerId, peerUsername);
          session = activeSessions.get(peerId);
        }
        if (session) {
          const { parked } = await session.send({ tag: 'leftChat', value: undefined });
          // A parked leftChat never reaches the wire: the outbox record is
          // cleared below before the queue can drain. Best-effort by design,
          // but keep the old behavior of at least logging the loss.
          if (parked) {
            console.warn('[p2p-managerV2] removeSession: leftChat to %s parked over budget — dropped with the outbox', peerId);
          }
        }
      } catch (err) {
        console.warn('[p2p-managerV2] removeSession: failed to send leftChat to %s: %s', peerId, err);
      }

      const peerSession = activeSessions.get(peerId);
      if (peerSession) {
        peerSession.dispose();
        activeSessions.delete(peerId);
      }
      pushContexts.delete(peerId);
      const peerRequests = await p2pChatDatabase.requests.where('peerId').equals(peerId).toArray();
      for (const req of peerRequests) {
        pendingAcceptMatchers.delete(req.requestId);
      }
      // Tear down the long-running identity-channel listener for this peer
      // — no further DeviceAdded/Removed events from them are interesting now.
      const identityUnsub = identityChannelUnsubs.get(peerId);
      if (identityUnsub) {
        identityUnsub();
        identityChannelUnsubs.delete(peerId);
      }
      // Tombstone the request rows instead of deleting them so a stale on-chain
      // copy can't resurface as a fresh incoming after a re-init / reload (the
      // in-memory `seenRequestIds` cache doesn't survive). UI lists already
      // filter to pending/accepted/declined, so 'removed' rows are invisible.
      await p2pChatDatabase.requests.where('peerId').equals(peerId).modify({ status: 'removed' });
      await lastValueFrom(deleteP2PMessages({ sessionId: peerId }));
      await lastValueFrom(deleteP2PRoom({ sessionId: peerId }));
      clearOutboxRecord(userId, peerId);
    },

    async sendMessage(peerId: string, content: MessageContent) {
      let session = activeSessions.get(peerId);
      if (!session) {
        const room = await p2pChatDatabase.rooms.where('peerId').equals(peerId).first();
        const peerUsername = room?.peerUsername ?? peerId;
        await this.startSession(peerId, peerUsername);
        session = activeSessions.get(peerId);
      }
      if (!session) throw new Error(`[p2p-managerV2] No active session for peer ${peerId}`);

      const defaultNodeEndpoint = (await environmentUseCase.getActive()).bulletinHopEndpoints?.[0] ?? '';
      const sdkContent = mapUiContentToSdk(content, defaultNodeEndpoint);
      if (!sdkContent) throw new Error(`[p2p-managerV2] Unsupported content type: ${content.type}`);

      // Pre-allocate the identity so the message can be persisted BEFORE we
      // await submission — mirrors iOS's lifecycle (`new` on send, `sent` once
      // submitted, `delivered` on the peer ACK) and guarantees the row exists
      // before any ack can land.
      const messageId = nanoid(12);
      const timestamp = Date.now();
      const peerForMessage = { type: 'p2p' as const, accountId: peerId, name: '' };
      seenMessageIds.add(messageId);

      // Optimistic write: `new` (Clock). A submission failure below leaves the
      // message in this state, matching iOS (no separate `failed` state).
      await writeMessage({
        messageId,
        sessionId: peerId,
        peer: peerForMessage,
        timestamp,
        content,
        status: { direction: 'outgoing', state: 'new' },
      });

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- mapUiContentToSdk widens to {tag,value}; the wire codec narrows again on encode
        await session.send(sdkContent as any, { messageId, timestamp });
      } catch (err) {
        if (isMessageTooLargeError(err)) {
          // The message can never fit a statement (until compaction lands) —
          // remove the optimistic row instead of leaving a forever-`new` clock.
          seenMessageIds.delete(messageId);
          await lastValueFrom(deleteP2PMessage({ messageId })).catch(() => {});
        }
        throw err;
      }

      // `new → sent` and the push notification fire from `handleMessageSent`
      // (the session's onSent) — when the statement actually lands, which for
      // a parked message is at drain time, not now.

      return { messageId };
    },

    async markAsRead(peerId: string) {
      await lastValueFrom(markP2PMessagesAsRead({ sessionId: peerId }));
    },

    async sendRequest(peerAccountId: string, peerUsername: string, welcomeMessage?: string) {
      console.info(
        '[p2p-managerV2] sendRequest: peer=%s username=%s welcome=%s',
        peerAccountId,
        peerUsername,
        welcomeMessage ? `"${welcomeMessage.slice(0, 40)}${welcomeMessage.length > 40 ? '…' : ''}"` : '(none)',
      );
      if (!userIdentity.identityChatPrivateKey) {
        throw new Error(
          '[p2p-managerV2] cannot send V2 chat request: no identityChatPrivateKey persisted. ' +
            'Re-pair against a multi-device PApp.',
        );
      }
      const peerAccountIdBytes = AccountIdCodec().enc(peerAccountId);

      // Look up the recipient's user chat P-256 pubkey from on-chain
      // `Resources.Consumers` — same lookup the existing V1 path uses.
      const recipientChatPubKey = await resolver.getPeerP256Key(peerAccountId);
      if (!recipientChatPubKey) {
        throw new Error(
          `[p2p-managerV2] Could not find on-chain chat key for ${peerUsername} (${peerAccountId}). ` +
            `The peer may not have completed user-identity registration.`,
        );
      }
      const { requestId, channelTopic } = await sendChatRequestV2({
        recipientAccountId: peerAccountIdBytes,
        recipientChatPubKey,
        senderIdentityAccountId: userIdentity.identitySr25519PublicKey,
        senderIdentityChatPrivateKey: userIdentity.identityChatPrivateKey,
        senderDevicePubKey: device.encryptionPublicKey,
        senderDeviceSeed: device.statementAccountSeed,
        welcomeMessage,
        statementStore,
      });

      // Seed the contact roster with the peer's chat pubkey so future V2
      // session traffic can ECDH against it. Per-device pubkey for the
      // outbound direction lands on the contact when the peer accepts and
      // their reply (or first session message) arrives — for now we leave
      // devices[] empty until we hear back.
      await upsertContactWithDevice(peerAccountId, toHex(recipientChatPubKey), undefined);

      const channelTopicHex = toHex(channelTopic);

      const newRequest: P2PChatRequest = {
        requestId,
        peerId: peerAccountId,
        peerUsername,
        direction: 'outgoing',
        status: 'pending',
        welcomeMessage,
        timestamp: Date.now(),
        channelTopic: channelTopicHex,
        userId,
        lastUpdate: Date.now(),
      };
      await writeRequest(newRequest);

      // Pre-create a room placeholder so the UI can navigate to the chat. We
      // re-use `peerP256PublicKey` to stash the recipient's chat key (looked
      // up above), so a future V2 startSession can read it without a second
      // chain round-trip.
      await lastValueFrom(
        createP2PRoom({
          sessionId: peerAccountId,
          peerId: peerAccountId,
          peerUsername,
          peerP256PublicKey: toHex(recipientChatPubKey),
          userId,
          createdAt: Date.now(),
          lastUpdate: Date.now(),
        }),
      );

      // Mirror the welcome message into `p2pChatDatabase.messages` as an
      // outgoing ChatMessage so DeviceSync's collector (which reads `messages`,
      // not `requests`) can replicate it to own-devices before the peer accepts.
      // `messageId` reuses `requestId` so the accept-handler's idempotent upsert
      // (in watchForAcceptSignalV2) collapses both writes into a single row.
      if (welcomeMessage) {
        const outgoingWelcome: ChatMessage = {
          messageId: requestId,
          sessionId: peerAccountId,
          peer: { type: 'p2p', accountId: peerAccountId, name: peerUsername },
          timestamp: newRequest.timestamp,
          content: { type: 'text', text: welcomeMessage },
          status: { direction: 'outgoing', state: 'sent' },
        };
        seenMessageIds.add(outgoingWelcome.messageId);
        await writeMessage(outgoingWelcome);
      }

      watchForAcceptSignalV2(requestId, peerAccountIdBytes, recipientChatPubKey, peerAccountId, peerUsername, welcomeMessage);
    },

    async acceptRequest(requestId: string) {
      const request = await p2pChatDatabase.requests.get(requestId);
      if (!request || request.direction !== 'incoming') {
        console.warn(
          '[p2p-managerV2] acceptRequest: ignoring requestId=%s (not found or not incoming, direction=%s)',
          requestId,
          request?.direction ?? 'missing',
        );
        return;
      }
      console.info(
        '[p2p-managerV2] acceptRequest: flipping requestId=%s peer=%s to accepted (welcome=%s) — sibling ChatsAdded should follow within ~50ms',
        requestId,
        request.peerId,
        request.welcomeMessage ? 'present' : 'absent',
      );

      // Flip the request to 'accepted' BEFORE any other writes so the contact
      // created below is immediately syncable. Otherwise the contact upsert
      // fires a local-change signal, the audited (50ms) pump runs while
      // acceptRequest is still in flight — typically during the awaited
      // postChatMessageOnIdentityChannel network call — sees a still-pending
      // request, filters the contact out of ChatsAdded by isContactSyncable,
      // advances the checkpoint past the contact's lastUpdate, and once the
      // request finally flips at the end of acceptRequest no subsequent pump
      // ever sees a contact change again → ChatsAdded never emits, sibling
      // never learns the chat was accepted. requests.update does NOT call
      // signalLocalChange, so moving the flip up doesn't add a premature pump.
      await p2pChatDatabase.requests.update(requestId, { status: 'accepted' });

      // Materialise a room so the accepted chat appears in the chat list.
      // Look up the peer's user identity chat pubkey from on-chain
      // `Resources.Consumers` — same source V2 sendRequest uses. Failure
      // here shouldn't block accept; we just store an empty pubkey and the
      // sendMessage path (deferred) will resolve again when needed.
      let peerChatPubKeyHex = '';
      try {
        const peerChatPubKey = await resolver.getPeerP256Key(request.peerId);
        if (peerChatPubKey) peerChatPubKeyHex = toHex(peerChatPubKey);
      } catch {
        // non-fatal
      }

      await lastValueFrom(
        createP2PRoom({
          sessionId: request.peerId,
          peerId: request.peerId,
          peerUsername: request.peerUsername ?? request.peerId,
          peerP256PublicKey: peerChatPubKeyHex,
          userId,
          createdAt: Date.now(),
          peerPushToken: request.pushToken,
          peerPlatform: request.pushPlatform,
          lastUpdate: Date.now(),
        }),
      );

      console.info(
        '[p2p-managerV2] acceptRequest: room created peer=%s peerChatPubKey=%s',
        request.peerId,
        peerChatPubKeyHex ? peerChatPubKeyHex.slice(0, 18) + '…' : '(empty — resolver failed)',
      );

      // Seed contact + device roster from the V2 chat request so the V2
      // multi-device envelope on outbound session messages can ECDH against
      // the sender device's encryption pubkey and key its `RequestDeviceInfo`
      // entries by the peer's real device sr25519.
      //
      // Decouple the chat-key gate from the device-topology gate: a transient
      // RPC failure on `getPeerP256Key` shouldn't drop a known device pubkey
      // (we'd otherwise hit "device topology unknown" on the next sendMessage),
      // and conversely a missing senderDevicePubKey shouldn't block storing
      // a freshly-resolved chat key. `upsertContactWithDevice` preserves the
      // existing chat key when called with empty.
      await upsertContactWithDevice(
        request.peerId,
        peerChatPubKeyHex,
        request.senderDevicePubKey,
        request.senderDeviceStatementAccountId,
      );

      // Propagate the requester's device to our sibling paired devices: persist a
      // `deviceAdded` chat-message row so device-sync replicates it via the
      // `Messages` entity, where the sibling's applier re-adds it to
      // `Contact(peer).devices`. The local roster was already updated above; this
      // is purely for sync. Without it, a sibling learns the contact via
      // `ChatsAdded` but with an empty device set and silently drops its
      // MultiRequests to the peer. Mirrors the `deviceAdded` persistence on the
      // identity-channel fan-out path and `deviceChatAccepted` on the accept path.
      if (request.senderDevicePubKey) {
        const statementAccountIdHex = request.senderDeviceStatementAccountId ?? toHex(AccountIdCodec().enc(request.peerId));
        const daId = `device-added:${request.peerId}:${statementAccountIdHex}`;
        const existingDaRow = await p2pChatDatabase.messages.get(daId);
        console.info(
          '[DEVICE-TRACE] acceptRequest WRITE peer-device row for sibling-MDS:\n  daId=%s\n  peerId(B)=%s\n  contained device.stmtAcct=%s (B device)\n  contained device.encPub=%s\n  (existed=%s)',
          daId,
          request.peerId,
          statementAccountIdHex,
          request.senderDevicePubKey,
          existingDaRow ? 'yes' : 'no',
        );
        if (!existingDaRow) {
          const daMsg: ChatMessage = {
            messageId: daId,
            sessionId: request.peerId,
            peer: { type: 'p2p', accountId: request.peerId, name: request.peerId },
            timestamp: Date.now(),
            content: {
              type: 'deviceAdded',
              statementAccountId: statementAccountIdHex,
              encryptionPublicKey: request.senderDevicePubKey,
            },
            status: { direction: 'incoming', state: 'seen' },
          };
          seenMessageIds.add(daMsg.messageId);
          await writeMessage(daMsg).catch(() => {});
        }

        // Also persist a `deviceChatAccepted` row symmetrically with the matcher
        // path. Sibling appliers (notably iOS) treat `deviceChatAccepted` as the
        // accept-marker that flips the local outgoing-request to 'accepted' and
        // surfaces the chat as established. They don't (yet) treat `deviceAdded`
        // as an accept marker — without this row, an iOS sibling that learned the
        // request via MDS sees our acceptance as just a roster bump and never
        // enters its accepted-message handler. Desktop's own applier dedupes by
        // statementAccountId and the contactAdded id, so emitting both is
        // idempotent. Mirror of the producer side at matcher (`:480-520`).
        const dcaId = `device-chat-accepted:${request.requestId}`;
        const existingDcaRow = await p2pChatDatabase.messages.get(dcaId);
        console.info(
          '[DEVICE-TRACE] acceptRequest WRITE deviceChatAccepted row for sibling-MDS:\n  dcaId=%s\n  peerId(B)=%s\n  contained device.stmtAcct=%s (B device)\n  contained device.encPub=%s\n  (existed=%s)',
          dcaId,
          request.peerId,
          statementAccountIdHex,
          request.senderDevicePubKey,
          existingDcaRow ? 'yes' : 'no',
        );
        if (!existingDcaRow) {
          const dcaMsg: ChatMessage = {
            messageId: dcaId,
            sessionId: request.peerId,
            peer: { type: 'p2p', accountId: userId, name: '' },
            timestamp: Date.now(),
            content: {
              type: 'deviceChatAccepted',
              requestId: request.requestId,
              statementAccountId: statementAccountIdHex,
              encryptionPublicKey: request.senderDevicePubKey,
            },
            // Outgoing — WE are the acceptor in this path; matches the
            // existing convention for `req-accepted:*` (contactAdded) in
            // acceptRequest. Matcher path keeps incoming(seen) because there
            // B is the acceptor and we just received their signal.
            status: { direction: 'outgoing', state: 'delivered' },
          };
          seenMessageIds.add(dcaMsg.messageId);
          await writeMessage(dcaMsg).catch(() => {});
        }
      }

      // Start the long-running identity-channel listener for this contact so we
      // pick up the peer's PApp `DeviceAdded`/`DeviceRemoved` fan-out as their
      // device topology changes.
      if (peerChatPubKeyHex) {
        startIdentityChannelListener(request.peerId, AccountIdCodec().enc(request.peerId), fromHex(peerChatPubKeyHex));
      }

      // Auto-start the V2 session so subsequent sendMessage works without
      // an explicit startSession call from the UI (mirrors V1 acceptRequest).
      if (peerChatPubKeyHex && request.senderDevicePubKey) {
        await manager.startSession(request.peerId, request.peerUsername ?? request.peerId).catch(() => {});
      }

      // Seed contact-added system event (acceptor side).
      const contactAddedMsg: ChatMessage = {
        messageId: `req-accepted:${request.requestId}`,
        sessionId: request.peerId,
        peer: { type: 'p2p', accountId: userId, name: '' },
        timestamp: request.timestamp,
        content: { type: 'contactAdded' },
        status: { direction: 'outgoing', state: 'delivered' },
      };
      seenMessageIds.add(contactAddedMsg.messageId);
      await writeMessage(contactAddedMsg);

      if (request.welcomeMessage) {
        const welcomeMsg: ChatMessage = {
          messageId: request.requestId,
          sessionId: request.peerId,
          peer: { type: 'p2p', accountId: request.peerId, name: request.peerUsername ?? '' },
          timestamp: request.timestamp,
          content: { type: 'text', text: request.welcomeMessage },
          status: { direction: 'incoming', state: 'seen' },
        };
        seenMessageIds.add(welcomeMsg.messageId);
        await writeMessage(welcomeMsg);
      }

      // Spec v0.1 §"Accepting a Chat Request": acceptance is a chat-content
      // `deviceChatAccepted { requestId, device }` sent on the **identity-level**
      // session `SessionId(B,A)` encrypted with `K(A,B)`. Identity-level is
      // mandatory: A needs to learn B's `DeviceInfo` to bootstrap per-device
      // transport, so the very message carrying the DeviceInfo can't itself
      // use per-device transport (circular dependency on B's device pub key).
      if (userIdentity.identityChatPrivateKey && peerChatPubKeyHex) {
        console.info(
          '[DEVICE-TRACE] acceptRequest POST deviceChatAccepted to B via identity-channel:\n  peerId(B)=%s\n  requestId=%s\n  carrying OUR device.stmtAcct=%s\n  carrying OUR device.encPub=%s',
          request.peerId,
          request.requestId,
          toHex(device.statementAccountPublicKey),
          toHex(device.encryptionPublicKey),
        );
        await postChatMessageOnIdentityChannel({
          ownIdentityChatPrivateKey: userIdentity.identityChatPrivateKey,
          ownIdentityAccountId: userIdentity.identitySr25519PublicKey,
          peerIdentityChatPublicKey: fromHex(peerChatPubKeyHex),
          peerIdentityAccountId: AccountIdCodec().enc(request.peerId),
          ownDeviceStatementAccountId: device.statementAccountPublicKey,
          ownDeviceEncryptionPrivateKey: device.encryptionPrivateKey,
          signerDeviceSeed: device.statementAccountSeed,
          statementStore,
          chatMessageContent: {
            tag: 'deviceChatAccepted',
            value: {
              requestId: request.requestId,
              device: {
                statementAccountId: device.statementAccountPublicKey,
                encryptionPublicKey: device.encryptionPublicKey,
              },
            },
          },
        }).catch(err => console.warn('[p2p-managerV2] failed to post deviceChatAccepted: %s', err));

        // Fan out `deviceAdded` for each of A's other paired Hosts to B via
        // the same identity-channel. Without this, B's `Contact(A).devices`
        // contains only THIS desktop's device — when A_mobile (or any other
        // sibling) later sends to B, B sees an unknown signer and either
        // drops the message or fails to derive the per-device transport.
        // Mirrors the deviceChatAccepted send but with each sibling's device
        // info instead of our own. Skip our own device (`ownStmtAcctHex`).
        const ownStmtAcctHex = toHex(device.statementAccountPublicKey);
        const siblings = await listShippableSiblings(ownStmtAcctHex);
        // Sibling deviceAdded fanout goes on the device-channel (matches mobile
        // semantics — bootstrap deviceChatAccepted above stays on identity-channel,
        // steady-state roster updates go per-peer-device). We need B's device to
        // address the channel; only post when we have it.
        if (request.senderDevicePubKey && request.senderDeviceStatementAccountId) {
          const peerDeviceEncPub = fromHex(request.senderDevicePubKey);
          const peerIdentityAcctId = AccountIdCodec().enc(request.peerId);
          console.info(
            '[DEVICE-TRACE] acceptRequest FANOUT START: %d sibling(s) to ship to peer=%s on device-channel; siblings=%o',
            siblings.length,
            request.peerId,
            siblings.map(s => ({ stmtAcct: s.statementAccountId, encPub: s.encryptionPublicKey })),
          );
          for (const sibling of siblings) {
            console.info(
              '[DEVICE-TRACE] acceptRequest FANOUT one sibling -> peer:\n  peerId(B)=%s\n  carrying SIBLING.stmtAcct=%s\n  carrying SIBLING.encPub=%s',
              request.peerId,
              sibling.statementAccountId,
              sibling.encryptionPublicKey,
            );
            await postChatMessageOnDeviceChannel({
              ownIdentityChatPrivateKey: userIdentity.identityChatPrivateKey,
              peerIdentityAccountId: peerIdentityAcctId,
              peerIdentityChatPublicKey: fromHex(peerChatPubKeyHex),
              peerDeviceEncryptionPublicKey: peerDeviceEncPub,
              ownDeviceStatementAccountId: device.statementAccountPublicKey,
              ownDeviceEncryptionPrivateKey: device.encryptionPrivateKey,
              signerDeviceSeed: device.statementAccountSeed,
              statementStore,
              chatMessageContent: {
                tag: 'deviceAdded',
                value: {
                  statementAccountId: fromHex(sibling.statementAccountId),
                  encryptionPublicKey: fromHex(sibling.encryptionPublicKey),
                },
              },
            }).catch(err =>
              console.warn('[p2p-managerV2] failed to post sibling deviceAdded sibling=%s: %s', sibling.statementAccountId, err),
            );
          }
        } else {
          console.warn(
            '[p2p-managerV2] acceptRequest: cannot fanout sibling deviceAdded — no peer device info on request (senderDevicePubKey=%s senderDeviceStatementAccountId=%s)',
            request.senderDevicePubKey ? 'present' : 'missing',
            request.senderDeviceStatementAccountId ? 'present' : 'missing',
          );
        }
      } else {
        console.warn(
          '[p2p-managerV2] cannot post deviceChatAccepted: identityChatPrivateKey=%s peerChatPubKey=%s',
          userIdentity.identityChatPrivateKey ? 'present' : 'missing',
          peerChatPubKeyHex ? 'present' : 'missing',
        );
      }
    },

    async declineRequest(requestId: string) {
      await p2pChatDatabase.requests.update(requestId, { status: 'declined' });
    },

    async cancelOutgoingRequest(requestId: string, peerId: string) {
      pendingAcceptMatchers.delete(requestId);
      await lastValueFrom(deleteP2PRequest({ requestId }));
      await this.removeSession(peerId);
    },

    async setBlocked(peerId: string, blocked: boolean) {
      const room = await p2pChatDatabase.rooms.where('peerId').equals(peerId).first();
      if (!room) {
        console.warn('[p2p-managerV2] setBlocked: no room for peer %s — ignoring', peerId);
        return;
      }
      await lastValueFrom(setP2PRoomBlocked({ sessionId: room.sessionId, isBlocked: blocked }));
    },

    async initialize() {
      if (disposed || ready) return;

      const existingRequests = await p2pChatDatabase.requests.where('userId').equals(userId).toArray();
      for (const r of existingRequests) seenRequestIds.add(r.requestId);

      // Inbound chat-request subscription: only available once the multi-device
      // handshake has handed us the user identity chat private key. Legacy
      // 161-byte handshake responses don't carry it, in which case desktop can
      // still send V2 requests but cannot decrypt incoming ones.
      if (userIdentity.identityChatPrivateKey) {
        requestUnsub = subscribeToIncomingRequestsV2(
          {
            ownAccountId: userIdentity.identitySr25519PublicKey,
            ownChatP256PrivateKey: userIdentity.identityChatPrivateKey,
            statementStore,
          },
          addIncomingRequest,
        );
      }

      // Re-arm accept-signal watchers for outgoing requests still pending
      // from a previous session (so app reload doesn't lose the signal).
      // Spec-aligned watcher needs the peer's identity chat pubkey, which
      // sendRequest seeded onto Contact.identityChatPublicKey at submit time.
      const pendingOutgoing = existingRequests.filter(r => r.direction === 'outgoing' && r.status === 'pending');
      for (const req of pendingOutgoing) {
        const contact = await contactRepository.get(req.peerId);
        if (!contact?.identityChatPublicKey) continue;
        watchForAcceptSignalV2(
          req.requestId,
          AccountIdCodec().enc(req.peerId),
          fromHex(contact.identityChatPublicKey),
          req.peerId,
          req.peerUsername ?? req.peerId,
          req.welcomeMessage,
        );
      }

      // Re-establish V2 sessions AND the identity-channel listener for each
      // existing room. Identity-channel listener catches roster fan-out events
      // (DeviceAdded/Removed) from the peer's PApp; per-device chatSession
      // catches regular messages. Both keyed off the same contact + chat key.
      const savedRooms = await p2pChatDatabase.rooms.where('userId').equals(userId).toArray();
      for (const room of savedRooms) {
        const contact = await contactRepository.get(room.peerId);
        if (contact?.identityChatPublicKey) {
          startIdentityChannelListener(room.peerId, AccountIdCodec().enc(room.peerId), fromHex(contact.identityChatPublicKey));
        }
        if (activeSessions.has(room.peerId)) continue;
        await manager.startSession(room.peerId, room.peerUsername ?? room.peerId).catch(() => {});
      }

      ready = true;

      if (typeof window !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- debug surface
        const dbg = (window as any).__p2pV2Debug;
        if (dbg) dbg.manager = manager;
      }
    },

    dispose() {
      disposed = true;
      ready = false;

      requestUnsub?.();
      requestUnsub = null;

      for (const [, unsub] of identityChannelUnsubs) unsub();
      identityChannelUnsubs.clear();
      pendingAcceptMatchers.clear();

      for (const [, session] of activeSessions) session.dispose();
      activeSessions.clear();
      pushContexts.clear();
      pushNotifiedIds.clear();
    },
  };

  // Surface this device's V2 identity on `window.__p2pV2Debug` for cross-client
  // debugging — lets you copy-paste device IDs into the peer if needed.
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- debug surface
    (window as any).__p2pV2Debug = {
      device: {
        statementAccountId: toHex(device.statementAccountPublicKey),
        encryptionPublicKey: toHex(device.encryptionPublicKey),
      },
      userIdentity: {
        identitySr25519PublicKey: toHex(userIdentity.identitySr25519PublicKey),
        identityChatPublicKey: toHex(userIdentity.identityChatPublicKey),
      },
      userId,
      // Probe Resources.Consumers for a peer accountId. Logs the raw record,
      // returns the chat pubkey hex (or null). Useful when sendRequest fails
      // with "Could not find on-chain chat key": you can run
      //   await window.__p2pV2Debug.probeChatKey('5DtDk...')
      // to see exactly what the chain has for that account.
      probeChatKey: async (peerAccountId: string) => {
        const key = await resolver.getPeerP256Key(peerAccountId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- debug surface
        const last = (window as any).__lastConsumerLookup;
        return { peerAccountId, chatKeyHex: key ? toHex(key) : null, raw: last?.raw };
      },
      // Inspect what's currently in the chat DB for the active user.
      // Useful when stale rooms/requests from prior test runs make it look
      // like a fresh send produced a result.
      dumpDb: async () => {
        const [rooms, requests, messages] = await Promise.all([
          p2pChatDatabase.rooms.where('userId').equals(userId).toArray(),
          p2pChatDatabase.requests.where('userId').equals(userId).toArray(),
          p2pChatDatabase.messages.toArray(),
        ]);
        return { rooms, requests, messages };
      },
      // Wipe the chat DB for the active user. Call this between V2 test
      // attempts so stale "accepted" markers from earlier runs don't show
      // up as fake fresh activity.
      // Subscribe to a V2-shape pagination topic for a specific peer device
      // sr25519 statementAccountId (32-byte hex). Use this to test the
      // hypothesis that android publishes chat requests on V2-shape topics
      // (keyed on senderDeviceAccountId + recipientUserAccountId + day) while
      // desktop currently only listens on the V1-shape topic (recipient-only).
      // Pass the peer's android device statementAccountId (hex, no 0x prefix
      // optional). Returns an unsubscribe function.
      probeV2Topic: (senderDeviceAccountIdHex: string) => {
        const senderBytes = fromHex(senderDeviceAccountIdHex.replace(/^0x/, ''));
        const day = getCurrentDay();
        if (!day) {
          console.warn('[p2pV2Debug] probeV2Topic: clock before chat-request epoch');
          return () => {};
        }
        const topic = computePaginationTopicV2(senderBytes, userIdentity.identitySr25519PublicKey, day.day);
        return trackedSubscribeStatements(statementStore, { matchAll: [topic] }, () => {});
      },
      wipeChatDb: async () => {
        const rooms = await p2pChatDatabase.rooms.where('userId').equals(userId).toArray();
        const peerIds = rooms.map(r => r.peerId);
        await Promise.all([
          p2pChatDatabase.rooms.where('userId').equals(userId).delete(),
          p2pChatDatabase.requests.where('userId').equals(userId).delete(),
          ...peerIds.map(peerId => p2pChatDatabase.messages.where('sessionId').equals(peerId).delete()),
        ]);
      },
    };
  }

  return manager;
};
