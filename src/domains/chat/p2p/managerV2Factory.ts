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
 *     delivered the user identity chat X25519 private key (carried on
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

import { type Encryption, type StatementStoreAdapter, createEncryption } from '@novasamatech/statement-store';
import { AccountId as AccountIdCodec } from '@polkadot-api/substrate-bindings';
import { nanoid } from 'nanoid';
import { fromHex, toHex } from 'polkadot-api/utils';
import { type Subscription, Subject, asyncScheduler, lastValueFrom, throttleTime } from 'rxjs';

import { environmentUseCase } from '@/domains/application';
import { type Contact, type Device, contactRepository as defaultContactRepository, contactWriteUseCase } from '@/domains/contact';
import { type DeviceIdentity, type UserIdentity, deviceIdentityService } from '@/domains/device';
// eslint-disable-next-line boundaries/dependencies -- chat needs the sibling-roster (own paired Hosts) to fan out deviceAdded to a new peer at accept time
import { deviceSyncRepository } from '@/domains/device-sync/repository';
import { chatMessageService } from '../session/service';
import { type ChatMessage, type MessageContent } from '../session/types';

import { type V2ChatPeerSession, createChatPeerSessionV2, isMessageTooLargeError } from './chatSessionV2';
import { type IdentityChannel, createIdentityChannel } from './identityChannel';
import { pushNotificationGateway } from './notifications/gateway';
import { peerGateway } from './peer/gateway';
import { peerSearchService } from './peer/service';
import { type PeerRosterHandle, createPeerRoster } from './peerRoster';
import { p2pChatDatabase } from './repository';
import {
  type ValidatedRequest,
  type ValidatedRequestCancel,
  type ValidatedRequestV2,
  chatRequestGateway,
} from './requests/gateway';
import { chatRequestService } from './requests/service';
import {
  advanceP2PRoomLastSentSeen,
  advanceP2PRoomPeerSeen,
  createP2PMessage,
  createP2PRoom,
  deleteP2PMessage,
  deleteP2PMessages,
  deleteP2PRoom,
  markP2PMessagesAsDelivered,
  markP2PMessagesAsRead,
  setP2PRoomBlocked,
  updateP2PMessageStatus,
  upsertP2PRequest,
} from './resource';
import { p2pService } from './service';
import { transportGateway } from './session-transport/gateway';
import { chatContentService } from './session-transport/service';
import { type AcceptSignal, type IdentityChannelEvent } from './session-transport/types';
import { trackedSubscribeStatements } from './subscription-registry';
import { type P2PChatManager, type P2PChatRequest, type SearchResult } from './types';

export type P2PChatManagerV2Params = {
  statementStore: StatementStoreAdapter;
  userId: string;
  device: DeviceIdentity;
  userIdentity: UserIdentity;
  contactRepository?: typeof defaultContactRepository;
};

// RFC 0006's send window: a seen receipt goes out at once, and a read inside the window sends
// one more when it ends.
const SEEN_RECEIPT_WINDOW_MS = 1000;

/**
 * Sibling rows safe to fan out to a peer as `deviceAdded`. A row whose enc
 * key is not a valid X25519 key must never ship: mobile receivers store it
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
    if (deviceIdentityService.isValidEncryptionPublicKey(fromHex(sibling.encryptionPublicKey))) return true;
    console.warn(
      '[p2p-managerV2] sibling fanout: skipping sibling=%s — encryptionPublicKey is not a valid X25519 key',
      sibling.statementAccountId,
    );
    return false;
  });
}

export const createP2PChatManagerV2 = async (params: P2PChatManagerV2Params): Promise<P2PChatManager> => {
  const { statementStore, userId, device, userIdentity } = params;
  const contactRepository = params.contactRepository ?? defaultContactRepository;

  /**
   * Upsert the peer-side contact roster for V2 chat traffic.
   *
   * Each `Device` entry stores a peer device's `statementAccountId` (sr25519,
   * used as the `D(B)` input to SessionId derivation on incoming subscriptions
   * and as the `RequestDeviceInfo.statementAccountId` key in MultiRequest
   * envelopes) and `encryptionPublicKey` (X25519, used as the key-agreement counterparty
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
      // enc key is not a valid X25519 key instead of persisting them. One bad
      // roster entry breaks every outgoing MultiRequest to this contact (the
      // per-device key wrap throws and the whole send fails).
      const hasValidDeviceKey =
        peerDevicePubKeyHex !== undefined && deviceIdentityService.isValidEncryptionPublicKey(fromHex(peerDevicePubKeyHex));
      if (peerDevicePubKeyHex !== undefined && !hasValidDeviceKey) {
        console.warn(
          '[p2p-managerV2] upsertContactWithDevice: dropping device=%s for peer=%s — encryptionPublicKey is not a valid X25519 key',
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
        await contactWriteUseCase.upsertContact({
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
      await contactWriteUseCase.upsertContact(merged);
    } catch {
      // non-fatal
    }
  };

  const { backendUrl, iosBundleId } = await environmentUseCase.getActive();
  const resolver = peerGateway.createPeerResolver(backendUrl);
  const seenMessageIds = new Set<string>();
  const seenRequestIds = new Set<string>();
  const activeSessions = new Map<string, V2ChatPeerSession>();
  const seenTriggers = new Map<string, { trigger: Subject<void>; subscription: Subscription }>();

  // Mirrors `P2PRoom.isBlocked` for the ONE caller that cannot await a Dexie read: the
  // synchronous `onMessage`. Every other block check reads the room (see `listBlockedPeerIds`
  // for the shared rule) — keep it that way, or the mirror becomes a second source of truth
  // that can drift. Because the only reader lives inside a live session, and a session only
  // comes up through `startSession`'s read-through below, a stale entry can never be consulted.
  const blockedPeers = new Set<string>();

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
  // `pushId` is a USER-level value: it is hashed over the identity SessionIdParam, exactly like the
  // identity channel's topic (`startIdentityChannelListener` → `ownIdentityAccountId`), and the peer
  // stores it per contact — one id for our whole device set, not one per device. `userId` is
  // SS58(device.statementAccountPublicKey), so deriving from it produces an id no peer ever
  // computes: the receiver looks up the contact by hash(identity-secret, ownIdentity + peerIdentity),
  // finds nothing, and renders "Unsupported message" instead of the message.
  // Mirrors Android's `RealContactChatSession.outgoingPushId`, which reads from
  // `communicationSessions.identity`, and iOS's `ChatPushIdFactory` signer account.
  const ownIdentityAccountIdBytes = userIdentity.identitySr25519PublicKey;

  // One long-running subscription per known peer on the identity-level topic
  // `SessionId(A,B)` with outer key `K(A,B)`. Surfaces both bootstrap events
  // (accept signals from outgoing chat requests) and steady-state events
  // (DeviceAdded/DeviceRemoved fan-out from peer's PApp). Keyed by peer SS58.
  const identityChannels = new Map<string, IdentityChannel>();

  // Per-pending-outgoing-request matchers. The identity-channel listener
  // dispatches acceptSignal events to whichever matcher is registered for the
  // signal's `requestId`. Matchers remove themselves on first match — the
  // underlying subscription stays open (long-running) for future roster events.
  type AcceptMatcher = (signal: AcceptSignal) => void;
  const pendingAcceptMatchers = new Map<string, AcceptMatcher>();

  // An incoming cancel waits on the accept of its request: a cancel applied mid-accept would
  // find no room yet, and the accept would then create the chat the cancel meant to remove.
  // Each entry settles, and never rejects, when its `acceptRequest` returns or throws.
  const acceptsInFlight = new Map<string, Promise<void>>();

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
   * The message was accepted into the outgoing batch. Owns the `new → sent` flip and
   * the push notification — `sendMessage` does neither inline, so both happen off the
   * one signal rather than being guessed at the call site.
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
    const sdkContent = chatContentService.mapUiContentToSdk(row.content);
    if (!sdkContent) return;
    const room = await p2pChatDatabase.rooms
      .where('peerId')
      .equals(peerId)
      .first()
      .catch(() => undefined);
    if (!room?.peerPushToken) return;
    await pushNotificationGateway
      .sendPushNotification({
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
        backendUrl,
        iosBundleId,
      })
      .catch(() => {});
  };

  // One live roster per peer, read by that peer's session on every submit and whenever
  // the incoming topic set is rebuilt. Publishing to it replaces the old teardown-and-
  // rebuild dance for a roster change.
  const peerRosters = new Map<string, PeerRosterHandle>();

  const publishRoster = async (peerSs58: string) => {
    const roster = peerRosters.get(peerSs58);
    // No live session to publish into. The rebuild path this replaced still started one
    // when a room existed, so keep that behavior rather than dropping the roster change.
    if (!roster) return recreateSessionForPeer(peerSs58);
    const contact = await contactRepository.get(peerSs58);
    if (!contact) return;
    roster.set(
      contact.devices.map(d => ({
        statementAccountId: fromHex(d.statementAccountId),
        encryptionPublicKey: fromHex(d.encryptionPublicKey),
      })),
    );
  };

  /** Drops every live transport for a peer, leaving their room, messages and contact intact. */
  const teardownPeerTransport = (peerSs58: string) => {
    const session = activeSessions.get(peerSs58);
    if (session) {
      session.dispose();
      activeSessions.delete(peerSs58);
    }
    peerRosters.delete(peerSs58);
    pushContexts.delete(peerSs58);
    seenTriggers.get(peerSs58)?.subscription.unsubscribe();
    seenTriggers.delete(peerSs58);
    const identityChannel = identityChannels.get(peerSs58);
    if (identityChannel) {
      identityChannel.dispose();
      identityChannels.delete(peerSs58);
    }
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

  // Roster mutation from a peer's session content — apply to the peer Contact, then
  // publish to the live roster the running session reads through. Both roster sources
  // (session content and the identity channel) land here.
  const applyPeerDeviceAdded = async (peerSs58: string, incoming: Device) => {
    const existing = await contactRepository.get(peerSs58);
    if (existing) {
      const without = existing.devices.filter(d => d.statementAccountId !== incoming.statementAccountId);
      await contactWriteUseCase.upsertContact({ ...existing, devices: [...without, incoming] });
    }
    // The running session reads the roster live, so there is nothing to rebuild.
    await publishRoster(peerSs58);
  };

  const applyPeerDeviceRemoved = async (peerSs58: string, removedStatementAccountIdHex: string) => {
    const existing = await contactRepository.get(peerSs58);
    if (existing) {
      await contactWriteUseCase.upsertContact({
        ...existing,
        devices: existing.devices.filter(d => d.statementAccountId !== removedStatementAccountIdHex),
      });
    }
    await publishRoster(peerSs58);
  };

  // ── Identity-channel listener (per-peer, long-running) ──────────────────

  const onIdentityChannelEvent = async (peerSs58: string, event: IdentityChannelEvent) => {
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
        // Bootstrap, not a roster change: the peer's devices were just learned, so there
        // may be no session yet (or one built against an empty roster). Rebuild, don't publish.
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
      // Same live-roster publish as the session-content path — the running session picks
      // the device up without a teardown, which would strand its in-flight delivery waiters.
      await publishRoster(peerSs58);
      return;
    }

    if (event.tag === 'deviceRemoved') {
      const removedHex = toHex(event.statementAccountId);
      const existing = await contactRepository.get(peerSs58);
      if (existing) {
        await contactWriteUseCase.upsertContact({
          ...existing,
          devices: existing.devices.filter(d => d.statementAccountId !== removedHex),
        });
      }
      await publishRoster(peerSs58);
    }
  };

  const startIdentityChannelListener = (
    peerSs58: string,
    peerIdentityAccountId: Uint8Array,
    peerIdentityChatPublicKey: Uint8Array,
  ): void => {
    if (identityChannels.has(peerSs58)) {
      return;
    }
    if (!userIdentity.identityChatPrivateKey) {
      console.warn('[p2p-managerV2] identity-channel listener: cannot start for peer=%s — no identityChatPrivateKey', peerSs58);
      return;
    }

    const channel = createIdentityChannel({
      ownIdentityChatPrivateKey: userIdentity.identityChatPrivateKey,
      ownIdentityAccountId: userIdentity.identitySr25519PublicKey,
      peerIdentityChatPublicKey,
      peerIdentityAccountId,
      ownDeviceSeed: device.statementAccountSeed,
      statementStore,
      onEvent: event => {
        void onIdentityChannelEvent(peerSs58, event);
      },
    });
    identityChannels.set(peerSs58, channel);
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
      return;
    }
    if (!userIdentity.identityChatPrivateKey) {
      console.warn(
        '[p2p-managerV2] watchForAcceptSignalV2: no identityChatPrivateKey, cannot arm matcher requestId=%s',
        requestId,
      );
      return;
    }

    // Identity-channel listener is shared across requests/roster events for
    // this peer. Start it if we don't already have one running.
    startIdentityChannelListener(peerAccountId, peerIdentityAccountId, peerIdentityChatPublicKey);

    pendingAcceptMatchers.set(requestId, async signal => {
      pendingAcceptMatchers.delete(requestId);

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
      // but doesn't need to complete before the audit pump. Captured so the
      // sibling fanout below can sequence after it (single start, no second
      // concurrent call) and route the roster updates through the live session.
      const sessionStarted = manager.startSession(peerAccountId, peerUsername).catch(() => {});

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
          // Sequence after the single session start above so the fanout routes
          // through the live session (no second concurrent startSession call).
          await sessionStarted;
          const siblings = await listShippableSiblings(ownStmtAcctHex);
          // Route through the live session (one statement, one allocator) — see
          // shipSiblingDeviceAddedThroughSession. Device-channel matches mobile
          // semantics (Android `communicationSessions.main`, iOS per-peer-device
          // subscription); bootstrap `deviceChatAccepted` stays on the
          // identity-channel.
          await shipSiblingDeviceAddedThroughSession(peerAccountId, siblings, {
            ownIdentityChatPrivateKey: userIdentity.identityChatPrivateKey!,
            peerIdentityAccountId,
            peerIdentityChatPublicKey,
            peerDeviceEncryptionPublicKey: acceptorDevice.encryptionPublicKey,
            ownDeviceStatementAccountId: device.statementAccountPublicKey,
            ownDeviceEncryptionPrivateKey: device.encryptionPrivateKey,
            signerDeviceSeed: device.statementAccountSeed,
            statementStore,
          });
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

  async function publishRequestCancel(request: P2PChatRequest): Promise<void> {
    const { requestId, peerId, channelTopic } = request;

    try {
      if (!channelTopic) {
        console.warn('[p2p-managerV2] chat request cancel not published requestId=%s: %s', requestId, 'no channel topic');
        return;
      }
      const recipientChatPubKey = await resolver.getPeerChatKey(peerId);
      if (!recipientChatPubKey) {
        console.warn('[p2p-managerV2] chat request cancel not published requestId=%s: %s', requestId, 'peer has no chat key');
        return;
      }

      await chatRequestGateway.sendChatRequestCancel({
        requestId,
        requestTimestamp: request.timestamp,
        channelTopic: fromHex(channelTopic),
        recipientAccountId: AccountIdCodec().enc(peerId),
        recipientChatPubKey,
        senderIdentityAccountId: userIdentity.identitySr25519PublicKey,
        senderIdentityChatPrivateKey: userIdentity.identityChatPrivateKey,
        senderDeviceSeed: device.statementAccountSeed,
        statementStore,
      });
    } catch (err) {
      console.warn('[p2p-managerV2] chat request cancel not published requestId=%s: %s', requestId, err);
    }
  }

  // ── Incoming request handler ────────────────────────────────────────────

  // Not gated by `seenRequestIds`: a cancel shares its request's id, and the request it
  // cancels has usually been seen already.
  function applyIncomingCancel(cancel: ValidatedRequestCancel): void {
    const { requestId } = cancel;

    void (async () => {
      try {
        const peerId = AccountIdCodec().dec(cancel.senderIdentityAccountId);
        const peerChatKey = await resolver.getPeerChatKey(peerId);
        if (!peerChatKey) {
          console.warn('[p2p-managerV2] applyIncomingCancel: ignoring requestId=%s — sender has no chat key', requestId);
          return;
        }

        const sharedSecret = p2pService.computeSharedSecret(userIdentity.identityChatPrivateKey, peerChatKey);
        const identityProof = { identityAccountId: cancel.senderIdentityAccountId, proof: cancel.identityProof };
        if (!chatRequestService.isCancelProofValid(sharedSecret, identityProof, requestId)) {
          console.warn('[p2p-managerV2] applyIncomingCancel: ignoring requestId=%s — proof does not match', requestId);
          return;
        }

        // Nothing else may be awaited between this and the transaction: an accept that
        // starts in that gap would read the row before the cancel writes it.
        await acceptsInFlight.get(requestId);

        const action = await p2pChatDatabase.requests.db.transaction(
          'rw',
          p2pChatDatabase.requests,
          p2pChatDatabase.rooms,
          p2pChatDatabase.messages,
          async () => {
            const request = await p2pChatDatabase.requests.get(requestId);
            const room = await p2pChatDatabase.rooms.get(peerId);
            const messages =
              request?.status === 'accepted' ? await p2pChatDatabase.messages.where('sessionId').equals(peerId).toArray() : [];
            const resolved = p2pService.resolveIncomingCancel({
              cancel: { requestId, peerId, timestamp: cancel.timestamp },
              request,
              room,
              messages,
            });

            if (resolved === 'tombstone') {
              await p2pChatDatabase.requests.put({
                requestId,
                peerId,
                direction: 'incoming',
                status: 'cancelled',
                timestamp: cancel.timestamp,
                userId,
                lastUpdate: Date.now(),
              });
            }
            if (resolved === 'cancelPending' || resolved === 'cancelAccepted') {
              await p2pChatDatabase.requests.update(requestId, { status: 'cancelled', lastUpdate: Date.now() });
            }
            if (resolved === 'cancelAccepted') {
              await p2pChatDatabase.messages.where('sessionId').equals(peerId).delete();
              // A P2P room's `sessionId` is its `peerId`.
              await p2pChatDatabase.rooms.delete(peerId);
            }

            return resolved;
          },
        );

        if (action === 'ignore') {
          console.debug('[p2p-managerV2] applyIncomingCancel: ignoring requestId=%s — nothing to cancel', requestId);
          return;
        }
        if (action !== 'cancelAccepted') return;

        // Leaving without `leftChat`: the peer cancelled, so it has already left.
        try {
          teardownPeerTransport(peerId);
          blockedPeers.delete(peerId);
          await contactWriteUseCase.deleteContactWithoutSync(peerId);
        } catch (err) {
          console.warn('[p2p-managerV2] applyIncomingCancel: cleanup failed for requestId=%s: %o', requestId, err);
        }
      } catch (err) {
        console.warn('[p2p-managerV2] applyIncomingCancel: ignoring requestId=%s — %o', requestId, err);
      }
    })();
  }

  async function applyIncomingSeen(peerId: string, seen: { messageId: string; timestamp: number }): Promise<void> {
    try {
      // A P2P room's `sessionId` is its `peerId`.
      const room = await p2pChatDatabase.rooms.get(peerId);
      if (!room) return;
      const messages = await p2pChatDatabase.messages.where('sessionId').equals(peerId).toArray();
      const position = p2pService.resolvePeerSeen(messages, seen);
      if (!position) return;
      await lastValueFrom(advanceP2PRoomPeerSeen({ sessionId: peerId, position }));
    } catch (err) {
      console.warn('[p2p-managerV2] applyIncomingSeen: dropped a seen receipt from peer=%s — %o', peerId, err);
    }
  }

  async function sendSeenReceipt(peerId: string): Promise<void> {
    try {
      const session = activeSessions.get(peerId);
      if (!session) return;
      const room = await p2pChatDatabase.rooms.where('peerId').equals(peerId).first();
      if (!room || room.isBlocked) return;
      const requests = await p2pChatDatabase.requests.where('peerId').equals(peerId).toArray();
      if (requests.some(request => request.status === 'pending')) return;
      const messages = await p2pChatDatabase.messages.where('sessionId').equals(room.sessionId).toArray();
      const lastSeen = p2pService.findLastSeenMessage(messages);
      if (!lastSeen) return;
      const position = chatMessageService.positionOf(lastSeen);
      if (room.lastSentSeen && chatMessageService.compareMessagePositions(position, room.lastSentSeen) <= 0) return;

      const outcome = await session.sendSeen(position);
      if (outcome !== 'delivered') return;
      // The chat may have been removed while the receipt waited for its ack.
      const named = await p2pChatDatabase.messages.get(position.messageId);
      if (!named) return;
      await lastValueFrom(advanceP2PRoomLastSentSeen({ sessionId: room.sessionId, position }));
    } catch (err) {
      console.warn('[p2p-managerV2] sendSeenReceipt: skipped a seen receipt to peer=%s — %o', peerId, err);
    }
  }

  function pushSeenTrigger(peerId: string) {
    let entry = seenTriggers.get(peerId);
    if (!entry) {
      const trigger = new Subject<void>();
      const subscription = trigger
        .pipe(throttleTime(SEEN_RECEIPT_WINDOW_MS, asyncScheduler, { leading: true, trailing: true }))
        .subscribe(() => void sendSeenReceipt(peerId));
      entry = { trigger, subscription };
      seenTriggers.set(peerId, entry);
    }
    entry.trigger.next();
  }

  const isV2Validated = (r: object): r is ValidatedRequestV2 =>
    'senderDevicePubKey' in r && r.senderDevicePubKey instanceof Uint8Array;

  const addIncomingRequest = (validated: ValidatedRequest | ValidatedRequestV2): void => {
    const { requestId } = validated;
    if (seenRequestIds.has(requestId)) {
      return;
    }
    seenRequestIds.add(requestId);

    // For V2 the upstream decoder rewrites `senderAccountId` to the user
    // identity (so contact resolution lands on the user, not the device).
    const senderAccountIdStr = AccountIdCodec().dec(validated.senderAccountId);

    void (async () => {
      try {
        if (isV2Validated(validated)) {
          const peerChatKey = await resolver.getPeerChatKey(senderAccountIdStr);
          if (!peerChatKey) {
            // `getPeerChatKey` returns `null` for a failed lookup too, so a later
            // delivery of this id must be checked again.
            seenRequestIds.delete(requestId);
            console.warn('[p2p-managerV2] addIncomingRequest: ignoring requestId=%s — sender has no chat key', requestId);
            return;
          }

          const sharedSecret = p2pService.computeSharedSecret(userIdentity.identityChatPrivateKey, peerChatKey);
          const identityProof = { identityAccountId: validated.senderIdentityAccountId, proof: validated.senderIdentityProof };
          if (!chatRequestService.isIdentityProofValid(sharedSecret, identityProof, validated.senderDeviceStatementAccountId)) {
            console.warn('[p2p-managerV2] addIncomingRequest: ignoring requestId=%s — identity proof does not match', requestId);
            return;
          }
        }

        // Persistent dedup. The in-memory `seenRequestIds` set is wiped on every
        // manager re-init; without a Dexie-level check, a stale on-chain request
        // (from a previous round the user has already removed via `removeSession`)
        // would resurface as a fresh incoming after each reload. We keep tombstones
        // ('removed' status) so subsequent sightings of the same requestId are
        // silently ignored. The check and the write share one transaction: a cancel's
        // `cancelled` tombstone committed between them would otherwise be overwritten
        // by this copy, reviving a request its sender withdrew.
        const written = await p2pChatDatabase.requests.db.transaction(
          'rw',
          p2pChatDatabase.requests,
          p2pChatDatabase.rooms,
          async () => {
            const existing = await p2pChatDatabase.requests.get(requestId);
            if (existing) return false;

            // Mirrors Android's BlockedContactsRepository — drop incoming requests from
            // peers the user has blocked. Block state lives on the existing room row.
            const room = await p2pChatDatabase.rooms.where('peerId').equals(senderAccountIdStr).first();
            if (room?.isBlocked) return false;

            const newRequest: P2PChatRequest = {
              requestId,
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
              senderDeviceStatementAccountId: isV2Validated(validated)
                ? toHex(validated.senderDeviceStatementAccountId)
                : undefined,
              lastUpdate: Date.now(),
            };

            await p2pChatDatabase.requests.put(newRequest);

            return true;
          },
        );
        if (!written) return;

        resolver
          .getUsername(senderAccountIdStr)
          .then(username => {
            if (username) {
              p2pChatDatabase.requests.update(requestId, { peerUsername: username }).catch(() => {});
            }
          })
          .catch(() => {});
      } catch (err) {
        console.warn('[p2p-managerV2] addIncomingRequest: dropped requestId=%s — %o', requestId, err);
      }
    })();
  };

  // Ship each sibling's `deviceAdded` to `peerId` on the per-peer-device
  // channel THROUGH the live session, so all N siblings ride ONE statement on
  // the session's single (account, channel) slot and draw from the session's
  // shared expiry allocator. The previous per-sibling
  // `postChatMessageOnDeviceChannel` one-shots each minted a FRESH allocator on
  // the SAME channel: they raced on expiry priority (`ExpiryTooLow` churn) and
  // mutually evicted (one statement per channel — only the last sibling
  // survived for an offline peer).
  //
  // The CALLER owns session start — both sites already do it (matcher fires it
  // at the accept handler, `acceptRequest` awaits it before the fanout). This
  // helper must NOT call `startSession` itself: its re-entry guard is
  // idempotent only AFTER completion, so a second concurrent call races the
  // first (both pass the guard before either sets `activeSessions`) and creates
  // a duplicate, orphaned session. It just reads the started session and routes
  // through it. Falls back to the one-shot only when no session is present
  // (start failed / not yet up) — there the one-shot is the sole writer on the
  // channel, so there is no contention to dedup.
  const shipSiblingDeviceAddedThroughSession = async (
    peerId: string,
    siblings: { statementAccountId: string; encryptionPublicKey: string }[],
    fallback: Omit<Parameters<typeof transportGateway.postChatMessageOnDeviceChannel>[0], 'chatMessageContent'>,
  ): Promise<void> => {
    const session = activeSessions.get(peerId);

    for (const sibling of siblings) {
      // Annotate via the session's own send-content type so the `deviceAdded`
      // literal is checked against the union without an `as const` assertion.
      const chatMessageContent: Parameters<V2ChatPeerSession['send']>[0] = {
        tag: 'deviceAdded',
        value: {
          statementAccountId: fromHex(sibling.statementAccountId),
          encryptionPublicKey: fromHex(sibling.encryptionPublicKey),
        },
      };
      await (
        session
          ? session.send(chatMessageContent)
          : transportGateway.postChatMessageOnDeviceChannel({ ...fallback, chatMessageContent })
      ).catch(err =>
        console.warn('[p2p-managerV2] sibling fanout: deviceAdded failed sibling=%s: %s', sibling.statementAccountId, err),
      );
    }
  };

  // ── Manager object ──────────────────────────────────────────────────────

  const manager: P2PChatManager = {
    get isReady() {
      return ready;
    },

    async searchPeers(query: string): Promise<SearchResult[]> {
      const results = await resolver.searchUsers(query);

      // Drop the current user — self-chats are not a supported flow. A username
      // is registered under the user's *identity* account, so a self match must
      // compare against `identitySr25519PublicKey`, not the per-device statement
      // account (`userId`), which would never match and leak self into results.
      return peerSearchService.excludeSelfFromSearchResults(results, userIdentity.identitySr25519PublicKey);
    },

    async startSession(peerId: string, peerUsername: string) {
      if (disposed) return;
      if (activeSessions.has(peerId)) return;

      // Read through to Dexie rather than trusting the mirror: a room can disappear
      // underneath it (a sibling's `ChatsRemoved`), and a stale entry would leave the
      // chat permanently dead after re-pairing.
      const blockCheckRoom = await p2pChatDatabase.rooms.where('peerId').equals(peerId).first();
      if (blockCheckRoom?.isBlocked) {
        blockedPeers.add(peerId);
        return;
      }
      blockedPeers.delete(peerId);

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
      const peerRoster = createPeerRoster(
        contact.devices.map(d => ({
          statementAccountId: fromHex(d.statementAccountId),
          encryptionPublicKey: fromHex(d.encryptionPublicKey),
        })),
      );
      peerRosters.set(peerId, peerRoster);

      // User-level shared secret used for outgoing push-notification encryption
      // + pushId derivation. Same on every device of either user, so the mobile
      // receiver derives an identical secret regardless of which sibling sent.
      const pushSharedSecret = p2pService.computeSharedSecret(userIdentity.identityChatPrivateKey, peerIdentityChatPubKey);
      pushContexts.set(peerId, {
        sharedSecret: pushSharedSecret,
        encryption: createEncryption(pushSharedSecret),
        ownAccountId: ownIdentityAccountIdBytes,
        peerAccountId: peerAccountIdBytes,
      });

      const peer = { type: 'p2p' as const, accountId: peerId, name: peerUsername };

      // Cut-off for the batch-level ack below: anything sent in THIS run has its own
      // per-message waiter, so only older rows depend on the batch signal.
      const sessionStartedAt = Date.now();
      // The restored rows exist only at init, so one pass settles them and every later ack
      // would rescan the session for nothing. Trade-off: an outgoing row that device-sync
      // replicates from a sibling AFTER that pass keeps its `sent` state — as it did before
      // this callback existed, since no waiter on this device ever covered it.
      let batchDeliveryChecked = false;

      const session = createChatPeerSessionV2({
        identityChatPrivateKey: userIdentity.identityChatPrivateKey,
        ownIdentityAccountId: userIdentity.identitySr25519PublicKey,
        ownDeviceStatementAccountId: device.statementAccountPublicKey,
        ownDeviceEncryptionPrivateKey: device.encryptionPrivateKey,
        ownDeviceSeed: device.statementAccountSeed,
        peerIdentityAccountId: peerAccountIdBytes,
        peerIdentityChatPublicKey: peerIdentityChatPubKey,
        peerRoster,
        statementStore,
        onMessage: ({ messageId, timestamp, content }) => {
          // Before the dedup set: a message refused here must stay re-deliverable on unblock.
          if (blockedPeers.has(peerId)) return;
          if (seenMessageIds.has(messageId)) return;
          seenMessageIds.add(messageId);

          // RFC 0006: a seen receipt moves the room's `peerSeen` and is never stored as a message.
          if (content.tag === 'seen') {
            void applyIncomingSeen(peerId, { messageId: content.value.messageId, timestamp: Number(content.value.timestamp) });
            return;
          }

          // Push token from peer. Two writes, no display:
          //   1. Denormalise onto the Room (`peerPushToken`) — what THIS device
          //      reads to attach a push to its own outgoing messages.
          //   2. Keep the statement as a chat-message row so `device-sync`
          //      replicates the token to our other paired devices (Android
          //      parity: `Token` is a chat statement; the sibling's applier
          //      writes it into its own `rooms.peerPushToken`). Without (2) a
          //      sibling that only learned the contact via sync can't push.
          // Original `messageId`/`timestamp` are kept so siblings see the
          // authentic statement; `isSyncCarrier` hides it from every surface.
          // `iOSVoIP` tokens are CallKit wake-ups; desktop never initiates calls
          // (no dataChannelOffer producer), so drop them rather than overwrite
          // the regular `'Android' | 'iOS'` value on `peerPlatform`.
          if (content.tag === 'token') {
            const tokenValue = content.value;
            const platform = tokenValue.platform;
            if (platform !== 'Android' && platform !== 'iOS') return;
            const tokenHex = typeof tokenValue.token === 'string' ? tokenValue.token.replace(/^0x/, '') : '';
            if (!tokenHex) return;
            p2pChatDatabase.rooms
              .where('peerId')
              .equals(peerId)
              .modify({ peerPushToken: tokenHex, peerPlatform: platform })
              .catch(() => {});
            const tokenMsg: ChatMessage = {
              messageId,
              sessionId: peerId,
              peer,
              timestamp,
              content: { type: 'token', token: tokenHex, platform },
              status: { direction: 'incoming', state: 'seen' },
            };
            writeMessage(tokenMsg).catch(() => {});
            return;
          }

          // The identity channel (`identityChannel.ts` → `onIdentityChannelEvent`) is the
          // authoritative consumer of `chatAccepted` (Android legacy) and
          // `deviceChatAccepted` (spec / iOS). Sessions only run post-bootstrap,
          // so any accept reaching this callback has already been processed
          // upstream — drop it to avoid duplicate "contactAdded" system rows.
          //   TODO(android-migrate): remove the `chatAccepted` branch when
          //   Android emits `deviceChatAccepted @20` exclusively.
          if (content.tag === 'chatAccepted' || content.tag === 'deviceChatAccepted') return;

          // Device roster mutations (V2 multi-device) — apply to the peer Contact, then
          // publish to the live roster the running session reads through. No teardown:
          // disposing would strand the in-flight delivery waiters, and the SDK re-derives
          // its incoming topic set from the roster anyway. Same path as the identity
          // channel's own deviceAdded/deviceRemoved handling.
          if (content.tag === 'deviceAdded') {
            const { statementAccountId, encryptionPublicKey } = content.value;
            const incoming: Device = {
              statementAccountId: toHex(statementAccountId),
              encryptionPublicKey: toHex(encryptionPublicKey),
            };
            void applyPeerDeviceAdded(peerId, incoming);
            return;
          }

          if (content.tag === 'deviceRemoved') {
            const { statementAccountId } = content.value;
            void applyPeerDeviceRemoved(peerId, toHex(statementAccountId));
            return;
          }

          const mapped = chatContentService.mapSdkContent(content);
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
        onBatchDelivered: () => {
          // The peer acked the batch, which carries every message they hadn't acked.
          // Messages from earlier runs have no waiter left — the SDK cannot restore
          // their tokens — so this is the only thing that moves them past `sent`.
          if (batchDeliveryChecked) return;
          batchDeliveryChecked = true;
          void lastValueFrom(markP2PMessagesAsDelivered({ sessionId: peerId, before: sessionStartedAt })).catch(() => {});
        },
        onSent: messageId => {
          void handleMessageSent(peerId, messageId);
        },
        onUndeliverable: messageId => {
          // The message can never reach a statement (too large, or no usable peer
          // device). Remove the optimistic row instead of leaving a forever-`new`
          // clock on a message that will never go out.
          seenMessageIds.delete(messageId);
          void lastValueFrom(deleteP2PMessage({ messageId })).catch(() => {});
        },
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
          // Best-effort by design: the session is disposed immediately below, so a
          // leftChat still queued behind a full batch never reaches the wire.
          await session.send({ tag: 'leftChat', value: undefined });
        }
      } catch (err) {
        console.warn('[p2p-managerV2] removeSession: failed to send leftChat to %s: %s', peerId, err);
      }

      teardownPeerTransport(peerId);
      // The room carries the block flag and is about to be deleted — drop the mirror
      // with it, or a later re-pair with this peer starts blocked.
      blockedPeers.delete(peerId);
      const peerRequests = await p2pChatDatabase.requests.where('peerId').equals(peerId).toArray();
      for (const req of peerRequests) {
        pendingAcceptMatchers.delete(req.requestId);
      }
      // Tombstone the request rows instead of deleting them so a stale on-chain
      // copy can't resurface as a fresh incoming after a re-init / reload (the
      // in-memory `seenRequestIds` cache doesn't survive). UI lists already
      // filter to pending/accepted/declined, so 'removed' rows are invisible.
      await p2pChatDatabase.requests.where('peerId').equals(peerId).modify({ status: 'removed' });
      await lastValueFrom(deleteP2PMessages({ sessionId: peerId }));
      await lastValueFrom(deleteP2PRoom({ sessionId: peerId }));
      // Forget the contact too — leaving a chat requires re-pairing to chat again.
      // This also tombstones the contact and pokes device-sync, so the leave
      // propagates as ChatsRemoved to the user's other paired devices (without
      // this, siblings never learn the chat was left and later messages from
      // the peer land with no local room to apply them to).
      await contactWriteUseCase.deleteContact(peerId);
    },

    async sendMessage(peerId: string, content: MessageContent) {
      const room = await p2pChatDatabase.rooms.where('peerId').equals(peerId).first();
      // Unreachable from the UI, which swaps the composer for the unblock banner; this
      // stops a programmatic caller reviving the session `setBlocked` tore down. Read from
      // the room, not the mirror — this path awaits Dexie anyway, so it can use the truth.
      if (room?.isBlocked) throw new Error(`[p2p-managerV2] cannot send to blocked peer ${peerId}`);

      let session = activeSessions.get(peerId);
      if (!session) {
        await this.startSession(peerId, room?.peerUsername ?? peerId);
        session = activeSessions.get(peerId);
      }
      if (!session) throw new Error(`[p2p-managerV2] No active session for peer ${peerId}`);

      const defaultNodeEndpoint = (await environmentUseCase.getActive()).bulletinHopEndpoints?.[0] ?? '';
      const sdkContent = chatContentService.mapUiContentToSdk(content, defaultNodeEndpoint);
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
      if (disposed) return;
      pushSeenTrigger(peerId);
    },

    async sendRequest(peerAccountId: string, peerUsername: string, welcomeMessage?: string) {
      if (!userIdentity.identityChatPrivateKey) {
        throw new Error(
          '[p2p-managerV2] cannot send V2 chat request: no identityChatPrivateKey persisted. ' +
            'Re-pair against a multi-device PApp.',
        );
      }
      const peerAccountIdBytes = AccountIdCodec().enc(peerAccountId);

      const recipientChatPubKey = await resolver.getPeerChatKey(peerAccountId);
      if (!recipientChatPubKey) {
        throw new Error(
          `[p2p-managerV2] Could not find on-chain chat key for ${peerUsername} (${peerAccountId}). ` +
            `The peer may not have completed user-identity registration.`,
        );
      }
      const { requestId, channelTopic } = await chatRequestGateway.sendChatRequestV2({
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

      // Pre-create a room placeholder so the UI can navigate to the chat.
      await lastValueFrom(
        createP2PRoom({
          sessionId: peerAccountId,
          peerId: peerAccountId,
          peerUsername,
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
      const inFlight = acceptsInFlight.get(requestId);
      if (inFlight) return inFlight;

      let settleAccept: VoidFunction = () => {};
      acceptsInFlight.set(
        requestId,
        new Promise<void>(resolve => {
          settleAccept = resolve;
        }),
      );
      try {
        const request = await p2pChatDatabase.requests.get(requestId);
        if (!request || request.direction !== 'incoming' || request.status !== 'pending') {
          console.warn(
            '[p2p-managerV2] acceptRequest: ignoring requestId=%s (not found or not a pending incoming request, direction=%s status=%s)',
            requestId,
            request?.direction ?? 'missing',
            request?.status ?? 'missing',
          );
          return;
        }

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

        // Look up the peer's user identity chat pubkey from on-chain
        // `Resources.Consumers` — same source V2 sendRequest uses. It keys the
        // identity-channel listener below. Failure here shouldn't block accept:
        // it stays empty, the listener is skipped, and the sendMessage path
        // (deferred) resolves the key again when needed.
        let peerChatPubKeyHex = '';
        try {
          const peerChatPubKey = await resolver.getPeerChatKey(request.peerId);
          if (peerChatPubKey) peerChatPubKeyHex = toHex(peerChatPubKey);
        } catch {
          // non-fatal
        }

        // Materialise a room so the accepted chat appears in the chat list.
        await lastValueFrom(
          createP2PRoom({
            sessionId: request.peerId,
            peerId: request.peerId,
            peerUsername: request.peerUsername ?? request.peerId,
            userId,
            createdAt: Date.now(),
            peerPushToken: request.pushToken,
            peerPlatform: request.pushPlatform,
            lastUpdate: Date.now(),
          }),
        );

        // Seed contact + device roster from the V2 chat request so the V2
        // multi-device envelope on outbound session messages can ECDH against
        // the sender device's encryption pubkey and key its `RequestDeviceInfo`
        // entries by the peer's real device sr25519.
        //
        // Decouple the chat-key gate from the device-topology gate: a transient
        // RPC failure on `getPeerChatKey` shouldn't drop a known device pubkey
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

        // Persist the requester's push token as a `token` chat-message row so
        // device-sync replicates it to our other paired devices. Here B's token
        // arrived as a `RequestContentV2.pushToken` *field* (not a standalone
        // `token` statement), so — unlike the live-session path — there is no
        // original statement to keep; synthesize one with a deterministic id. The
        // Room's `peerPushToken` (set at room creation above) already covers THIS
        // device's own push-send; this row is purely for the siblings, which would
        // otherwise learn the contact via `ChatsAdded` but never B's token and so
        // never push. `isSyncCarrier` hides it from every visible surface.
        if (request.pushToken && (request.pushPlatform === 'Android' || request.pushPlatform === 'iOS')) {
          const tokenId = `token-req:${request.requestId}`;
          const existingTokenRow = await p2pChatDatabase.messages.get(tokenId);
          if (!existingTokenRow) {
            const tokenMsg: ChatMessage = {
              messageId: tokenId,
              sessionId: request.peerId,
              peer: { type: 'p2p', accountId: request.peerId, name: request.peerId },
              timestamp: Date.now(),
              content: { type: 'token', token: request.pushToken, platform: request.pushPlatform },
              status: { direction: 'incoming', state: 'seen' },
            };
            seenMessageIds.add(tokenMsg.messageId);
            await writeMessage(tokenMsg).catch(() => {});
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
          // The listener owns the session; starting it here means the accept rides the same
          // acknowledged channel the peer's roster events arrive on.
          startIdentityChannelListener(request.peerId, AccountIdCodec().enc(request.peerId), fromHex(peerChatPubKeyHex));
          await identityChannels
            .get(request.peerId)
            ?.post({
              tag: 'deviceChatAccepted',
              value: {
                requestId: request.requestId,
                device: {
                  statementAccountId: device.statementAccountPublicKey,
                  encryptionPublicKey: device.encryptionPublicKey,
                },
              },
            })
            .catch((err: unknown) => console.warn('[p2p-managerV2] failed to post deviceChatAccepted: %s', err));

          // Fan out `deviceAdded` for each of A's other paired Hosts to B — on the
          // device channel, see below. Without this, B's `Contact(A).devices`
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
            // Route through the live session (started + awaited above) so all
            // siblings ride ONE statement / ONE allocator — see
            // shipSiblingDeviceAddedThroughSession.
            await shipSiblingDeviceAddedThroughSession(request.peerId, siblings, {
              ownIdentityChatPrivateKey: userIdentity.identityChatPrivateKey,
              peerIdentityAccountId: peerIdentityAcctId,
              peerIdentityChatPublicKey: fromHex(peerChatPubKeyHex),
              peerDeviceEncryptionPublicKey: peerDeviceEncPub,
              ownDeviceStatementAccountId: device.statementAccountPublicKey,
              ownDeviceEncryptionPrivateKey: device.encryptionPrivateKey,
              signerDeviceSeed: device.statementAccountSeed,
              statementStore,
            });
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
      } finally {
        acceptsInFlight.delete(requestId);
        settleAccept();
      }
    },

    async declineRequest(requestId: string) {
      await p2pChatDatabase.requests.update(requestId, { status: 'declined' });
    },

    async revealRequest(requestId: string) {
      await p2pChatDatabase.requests.update(requestId, { revealed: true });
    },

    async cancelOutgoingRequest(requestId: string, peerId: string) {
      const request = await p2pChatDatabase.requests.get(requestId);
      if (request?.direction !== 'outgoing' || request.status !== 'pending') {
        console.warn('[p2p-managerV2] cancelOutgoingRequest: ignoring requestId=%s — not a pending outgoing request', requestId);
        return;
      }
      pendingAcceptMatchers.delete(requestId);

      try {
        await this.removeSession(peerId);
      } finally {
        // The publish starts first so a failed status write cannot skip it, and the write
        // comes after `removeSession`, which tombstones every row of the peer as `removed`.
        void publishRequestCancel(request);
        await p2pChatDatabase.requests.update(requestId, { status: 'cancelled', lastUpdate: Date.now() });
      }
    },

    async setBlocked(peerId: string, blocked: boolean) {
      const room = await p2pChatDatabase.rooms.where('peerId').equals(peerId).first();
      if (!room) {
        console.warn('[p2p-managerV2] setBlocked: no room for peer %s — ignoring', peerId);
        return;
      }
      await lastValueFrom(setP2PRoomBlocked({ sessionId: room.sessionId, isBlocked: blocked }));

      // Before tearing down, so anything the disposing session flushes through
      // `onMessage` already sees the peer as blocked.
      if (blocked) {
        blockedPeers.add(peerId);
        teardownPeerTransport(peerId);
        return;
      }

      // Unblock restores exactly what `initialize` would have built for this
      // room. The room and its messages were never touched, so there is nothing
      // to restore beyond transport.
      blockedPeers.delete(peerId);
      const contact = await contactRepository.get(peerId);
      if (contact?.identityChatPublicKey) {
        startIdentityChannelListener(peerId, AccountIdCodec().enc(peerId), fromHex(contact.identityChatPublicKey));
      }
      await manager.startSession(peerId, room.peerUsername ?? peerId).catch(err => {
        console.warn('[p2p-managerV2] setBlocked: failed to restart session for %s: %s', peerId, err);
      });
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
        requestUnsub = chatRequestGateway.subscribeToIncomingRequestsV2(
          {
            ownAccountId: userIdentity.identitySr25519PublicKey,
            ownChatPrivateKey: userIdentity.identityChatPrivateKey,
            statementStore,
          },
          { onRequest: addIncomingRequest, onCancel: applyIncomingCancel },
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
        // No session, so no `onMessage` — nothing to mirror for a room that starts blocked.
        if (room.isBlocked) continue;
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

      for (const [, channel] of identityChannels) channel.dispose();
      identityChannels.clear();
      pendingAcceptMatchers.clear();

      for (const [, session] of activeSessions) session.dispose();
      activeSessions.clear();
      for (const [, { subscription }] of seenTriggers) subscription.unsubscribe();
      seenTriggers.clear();
      pushContexts.clear();
      pushNotifiedIds.clear();
      blockedPeers.clear();
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
      // Resolve a peer's chat pubkey. Useful when sendRequest fails with
      // "Could not find on-chain chat key": run
      //   await window.__p2pV2Debug.probeChatKey('5DtDk...')
      // to see whether the SDK has an identity record for that account.
      probeChatKey: async (peerAccountId: string) => {
        const contact = await resolver.getPeerContact(peerAccountId);
        return { peerAccountId, chatKeyHex: contact ? toHex(contact.chatKey) : null, username: contact?.username ?? null };
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
        const day = chatRequestService.getCurrentDay();
        if (!day) {
          console.warn('[p2pV2Debug] probeV2Topic: clock before chat-request epoch');
          return () => {};
        }
        const topic = chatRequestService.computePaginationTopicV2(senderBytes, userIdentity.identitySr25519PublicKey, day.day);
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
