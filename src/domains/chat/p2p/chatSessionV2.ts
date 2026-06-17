/**
 * V2 multi-device chat-session transport
 *
 * Outgoing statement shape:
 *
 *   wire `data` = encrypt(K(D(A), B), SCALE(
 *     StructuredStatementData::MultiRequest {
 *       encryptedRequest = AES_GCM(REQ_PK, SCALE(SingleRequest{requestId, messages: [SCALE(ChatMessage)]})),
 *       devicesInfo: [
 *         {
 *           statementAccountId: <recipient device sr25519>,
 *           encryptedKey: wrap(REQ_PK, ECDH(ownDeviceEncPriv, recipientDeviceEncPub))
 *         },
 *         …one entry per known peer device…
 *       ],
 *     }
 *   ))
 *
 *   topic   = SessionId(D(A), B) = khash( K(D(A),B), "session" || ownDeviceAcctId || peerIdentityAcctId || "/" || "/" )
 *   channel = khash( topic, "request" )
 *   K(D(A),B) = ECDH(ownDeviceEncPriv, peerIdentityChatPub)
 *
 * Incoming: one subscription per known peer device D(B'). For each, the
 * topic is SessionId(D(B'), A) and the outer key is K(D(B'),A) =
 * ECDH(ownIdentityChatPriv, peerDeviceEncPub) — the receiver-side derivation
 * of the same shared secret D(B') used on the wire. The inner MultiRequest
 * envelope is then unwrapped against this device's enc priv + the peer
 * device's enc pub, recovering REQ_PK and the inner SingleRequest.
 *
 * Statement proofs are signed with this device's sr25519 (the user-identity
 * sr25519 never leaves PApp).
 *
 * Identity-conflated fallback: when the peer roster only carries the peer
 * identity itself as a "device" (Android legacy — `chatAccepted @14` with no
 * acceptor device info, synthesised in managerV2Factory.ts), peerDevice
 * collapses to the peer identity and the topic + outer key reduce to the V1
 * pairwise shape — so spec-aligned code interoperates with V1 peers when no
 * real device topology is known.
 *
 * Receive supports a backward-compat path: a peer that emits a plain
 * `StructuredStatementData::Request` (V1 single-device) is still decoded,
 * so the upgrade can be one-sided. The send path always emits MultiRequest.
 *
 * Out of scope for this iteration: message-status state machines, session
 * resumption from on-chain history beyond a one-shot catch-up query, and
 * message compaction (HOP blob + reference message) for payloads that exceed
 * the statement budget on their own — those sends fail with
 * MessageTooLargeError. Batch overflow itself is handled: messages park in a
 * persistent FIFO outbox (localStorage, per peer) and drain on ACK.
 */

import { type Statement } from '@novasamatech/sdk-statement';
import {
  type StatementStoreAdapter,
  DataTooLargeError,
  createAccountId,
  createEncryption,
  createExpiryAllocator,
  createSessionId,
  createSr25519Prover,
  khash,
} from '@novasamatech/statement-store';
import { nanoid } from 'nanoid';
import { fromHex, toHex } from 'polkadot-api/utils';
import { type CodecType } from 'scale-ts';

import { type HexString } from '@/shared/types';
import { createAsyncTaskPool } from '@/shared/utils';

import { multiDeviceService } from './multi-device/service';
import { SingleRequest, SingleResponse, StructuredStatementData } from './requests/schemas';
import { p2pService } from './service';
import { transportGateway } from './session-transport/gateway';
import { ChatMessage as ChatMessageCodec } from './session-transport/schemas';
import { trackedSubscribeStatements } from './subscription-registry';
import { type OutboxPort } from './types';

const REQUEST_LABEL = new TextEncoder().encode('request');
const RESPONSE_LABEL = new TextEncoder().encode('response');

/**
 * Budget for the final encrypted statement `data`, in bytes. The Bulletin
 * statement store caps statements around 500KB *total encoded size* (proof +
 * channel + topics + expiry + data); 2KB leaves margin for the non-data
 * fields. `DataTooLargeError.available` is the chain's authoritative number —
 * the safety-net path logs it so this constant can be corrected if it drifts.
 */
const MAX_STATEMENT_DATA_BYTES = (500 - 2) * 1024;

const MESSAGE_TOO_LARGE_ERROR_NAME = 'MessageTooLargeError';

// No error classes (style.md) — a name-tagged Error + predicate.
function createMessageTooLargeError(size: number, budget: number): Error {
  const error = new Error(
    `[chat-session-v2] message alone exceeds the statement budget (${size} > ${budget} bytes) — cannot be sent until message compaction lands`,
  );
  error.name = MESSAGE_TOO_LARGE_ERROR_NAME;
  return error;
}

/** True for the `send()` rejection meaning "this message can never fit a statement". */
export function isMessageTooLargeError(err: unknown): boolean {
  return err instanceof Error && err.name === MESSAGE_TOO_LARGE_ERROR_NAME;
}

export type V2PeerDevice = {
  /** 32-byte peer device sr25519 (used as the `accountId` input to SessionId on receive, and as the device identifier in MultiDeviceRequest.devicesInfo). */
  statementAccountId: Uint8Array;
  /** 65-byte uncompressed P-256 device encryption pubkey (the peer device's persistent enc pub key — used for ECDH wrap of REQ_PK and as the receiver-side ECDH counterparty for the outer K(D(B'),A) layer). */
  encryptionPublicKey: Uint8Array;
};

export type V2ChatPeerSessionParams = {
  /** Local user identity chat P-256 private key (32 bytes). Delivered by the multi-device SSO handshake. Used only on the *receive* side to derive K(D(B'),A) — the outer key. */
  identityChatPrivateKey: Uint8Array;
  /** Local user identity sr25519 (32 bytes) — the `B` (recipient identity) input on incoming SessionId derivation. */
  ownIdentityAccountId: Uint8Array;
  /** This device's sr25519 statement-account public key (32 bytes) — the `D(A)` (sender device) input on outgoing SessionId derivation. */
  ownDeviceStatementAccountId: Uint8Array;
  /** This device's per-device P-256 private key (32 bytes). Used as the sender-side ECDH counterparty for both the outer K(D(A),B) layer and the per-recipient-device REQ_PK wrap. */
  ownDeviceEncryptionPrivateKey: Uint8Array;
  /** This device's sr25519 secret seed (64 bytes) for signing statements. */
  ownDeviceSeed: Uint8Array;
  /** Peer user identity sr25519 (32 bytes) — the `B` (recipient identity) input on outgoing SessionId derivation. */
  peerIdentityAccountId: Uint8Array;
  /** Peer user identity chat P-256 pubkey (65 bytes uncompressed) — the sender-side ECDH counterparty for the outer K(D(A),B) layer. */
  peerIdentityChatPublicKey: Uint8Array;
  /** Known peer devices. One incoming subscription per device; each is also a recipient on outgoing MultiDeviceRequest envelopes. */
  peerDevices: V2PeerDevice[];
  statementStore: StatementStoreAdapter;
  /** Called for every chat message decoded from incoming statements. */
  onMessage: (msg: {
    messageId: string;
    timestamp: number;
    content: CodecType<typeof ChatMessageCodec>['versioned']['value'];
  }) => void;
  /**
   * Called when the peer acknowledges receipt of one of our sent messages
   * (a success `Response` decoded off the session's response channel). Carries
   * the local `messageId` of the acked message so the manager can advance its
   * status `sent → delivered` — mirrors iOS, where `delivered` is the peer-side
   * ACK, not the on-chain submission confirmation (that is `sent`).
   */
  onDelivered: (messageId: string) => void;
  /**
   * Called when a message is FIRST carried by a successfully submitted
   * statement — immediately for normal sends, at drain time for parked ones
   * (possibly in a later app run). The manager owns the `new → sent` status
   * flip and the push notification behind this.
   */
  onSent: (messageId: string) => void;
  /**
   * Called when an already-parked message is dropped because it can no
   * longer fit any statement on its own (e.g. it parked when the peer's
   * device roster was smaller and the per-device envelope overhead has
   * since grown past the budget). Without the drop, strict FIFO would wedge
   * the queue behind it forever. The manager should treat this like a
   * MessageTooLargeError-rejected send: remove the optimistic row.
   */
  onUndeliverable?: (messageId: string) => void;
  /**
   * Persistence for the outbox (unacked batch + coverage + parked queue),
   * keyed by (user, peer) by the caller. Loaded once at session creation;
   * saved on every batch/queue mutation.
   */
  outbox: OutboxPort;
  /** Override of MAX_STATEMENT_DATA_BYTES — tests only. */
  maxStatementDataBytes?: number;
};

export type V2ChatPeerSession = {
  /**
   * `opts.messageId`/`opts.timestamp` let the caller pre-allocate the identity
   * so it can persist the message optimistically *before* awaiting submission
   * (and before any peer ACK can land). Omitted → generated internally.
   * `parked: true` in the result means the message was queued, NOT submitted —
   * it ships when the budget frees (best-effort callers like `leftChat`
   * should treat a parked send as not-yet-on-the-wire).
   */
  send: (
    content: CodecType<typeof ChatMessageCodec>['versioned']['value'],
    opts?: { messageId?: string; timestamp?: number },
  ) => Promise<{ messageId: string; timestamp: number; parked: boolean }>;
  dispose: () => void;
};

export const createChatPeerSessionV2 = (params: V2ChatPeerSessionParams): V2ChatPeerSession => {
  const {
    identityChatPrivateKey,
    ownIdentityAccountId,
    ownDeviceStatementAccountId,
    ownDeviceEncryptionPrivateKey,
    ownDeviceSeed,
    peerIdentityAccountId,
    peerIdentityChatPublicKey,
    peerDevices,
    statementStore,
    onMessage,
    onDelivered,
    onSent,
    onUndeliverable,
    outbox,
    maxStatementDataBytes = MAX_STATEMENT_DATA_BYTES,
  } = params;

  // ── Outgoing: K(D(A),B), SessionId(D(A), B) ─────────────────────────────
  // Sender-side ECDH uses our device enc priv key against the peer's
  // identity chat pub key. Both inputs are P-256.
  const outgoingSharedSecret = p2pService.computeSharedSecret(ownDeviceEncryptionPrivateKey, peerIdentityChatPublicKey);
  const outgoingEncryption = createEncryption(outgoingSharedSecret);

  const localDevice = { accountId: createAccountId(ownDeviceStatementAccountId), pin: undefined };
  const remoteIdentity = { accountId: createAccountId(peerIdentityAccountId), pin: undefined };
  const localIdentity = { accountId: createAccountId(ownIdentityAccountId), pin: undefined };

  const outgoingTopic = createSessionId(outgoingSharedSecret, localDevice, remoteIdentity);
  const outgoingChannel = khash(outgoingTopic, REQUEST_LABEL);
  // Acks ride the SAME outgoing topic as our requests (so the peer receives
  // them on the subscription it already opened for our device) but on a
  // distinct "response" channel — byte-parity with iOS
  // (`blake2b32("response", key=sessionId)`). Channel only namespaces the
  // statement so request/response expiries don't collide; topic is what
  // routes delivery.
  const outgoingResponseChannel = khash(outgoingTopic, RESPONSE_LABEL);

  console.info(
    '[MDSTEST topics SEND] topic=%s\n  ownDeviceStmtAcct=%s\n  peerIdentityAcct=%s\n  peerIdentityChatPub=%s\n  sharedSecret=%s',
    toHex(outgoingTopic),
    toHex(ownDeviceStatementAccountId),
    toHex(peerIdentityAccountId),
    toHex(peerIdentityChatPublicKey),
    toHex(outgoingSharedSecret),
  );

  const prover = createSr25519Prover(ownDeviceSeed);
  // One expiry source for this session's submits (requests, acks, drains all
  // ride this session's outgoing channel). Shared across the session so its
  // own same-second submits stay strictly increasing and supersede correctly.
  const expiryAllocator = createExpiryAllocator();

  // Expiry synchronization (the session spec's init step): seed the allocator's
  // floor from our own statements already live on the outgoing topic. They
  // survive from a previous app session (pinned-high expiries never lapse), so a
  // fresh allocator (floor 0) signs at the wall-clock priority and ties/loses to
  // the surviving statement, bouncing through priority-rejection retries before
  // it clears. Reads only the plaintext `.expiry` wire field, so — unlike the
  // SDK's full init() — it works even though our own MultiRequest inner is
  // unreadable to us. Submits await it once before their first post; raiseFloor
  // is monotonic, so a statement that lands mid-query keeps the counter ahead.
  const expiryFloorSynced: Promise<void> = (async () => {
    const result = await statementStore.queryStatements({ matchAll: [outgoingTopic] });
    if (result.isErr()) {
      console.warn('[chat-session-v2] expiry-floor sync failed topic=%s: %s', toHex(outgoingTopic), result.error.message);
      return;
    }
    let maxExpiry = 0n;
    for (const s of result.value) {
      if (s.expiry !== undefined && s.expiry > maxExpiry) maxExpiry = s.expiry;
    }
    expiryAllocator.raiseFloor(maxExpiry);
  })();

  const seenStatementIds = new Set<string>();
  const seenMessageIds = new Set<string>();

  // ── Outgoing unacked batch ───────────────────────────────────────────────
  // The statement store keeps ONE statement per (account, channel): every new
  // submit on `outgoingChannel` EVICTS the previous statement. Online peers
  // never notice (the live subscription delivers each statement as it lands),
  // but an OFFLINE peer only ever sees the single surviving statement on
  // catch-up — so the latest statement must carry EVERY not-yet-acked
  // message, or eviction silently drops the earlier ones. This mirrors the
  // protocol everywhere else: @novasamatech/statement-store `session.ts`
  // (`outgoingRequest` batching), Android (`Active.pendingMessages`), iOS
  // (`Request.messages[]` + one Response per request).
  type UnackedEntry = { messageId: string; bytes: Uint8Array; notified: boolean };
  let unackedEntries: UnackedEntry[] = [];
  // requestId → messageIds that submission carried (see the ack handler).
  const requestCoverage = new Map<string, Set<string>>();
  // Parked messages that didn't fit the statement budget. STRICT FIFO: once
  // anything is queued, every later send queues too (wire order = send
  // order; the SDK lets small messages jump — we deliberately don't).
  type QueuedEntry = { messageId: string; bytes: Uint8Array };
  let queuedEntries: QueuedEntry[] = [];
  let disposed = false;

  // ── Outbox restore ───────────────────────────────────────────────────────
  // Our own MultiRequest inner is unreadable to us (the one-shot key is
  // wrapped for recipient devices only), so unlike the SDK's init() we can't
  // rebuild the batch from the store — the persisted record IS the source.
  // Self-corrects against store drift: an expired/superseded statement is
  // re-carried by the next send/drain; ACKs that landed while the app was
  // closed are processed by the catch-up query against the restored coverage.
  const restored = outbox.load();
  if (restored) {
    try {
      unackedEntries = restored.batch.map(e => ({ messageId: e.messageId, bytes: fromHex(e.bytesHex), notified: e.notified }));
      for (const [requestId, messageIds] of Object.entries(restored.coverage))
        requestCoverage.set(requestId, new Set(messageIds));
      queuedEntries = restored.queue.map(e => ({ messageId: e.messageId, bytes: fromHex(e.bytesHex) }));
    } catch (e) {
      // Schema-valid but undecodable record (e.g. lax hex) — degrade to a
      // clean start instead of crashing session creation.
      console.warn('[chat-session-v2] outbox restore failed — starting clean: %s', e instanceof Error ? e.message : String(e));
      unackedEntries = [];
      requestCoverage.clear();
      queuedEntries = [];
      outbox.clear();
    }
  }

  const toHexBytes = (bytes: Uint8Array): HexString =>
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- polkadot-api toHex always produces 0x-prefixed output; the schema requires the literal type
    toHex(bytes) as HexString;

  const persistOutbox = () => {
    // A disposed session must never write: the manager may have already
    // recreated a session for this peer against the same record
    // (deviceAdded/deviceRemoved recreate), or removeSession may have cleared
    // it — a late in-flight op would clobber the new session's state or
    // resurrect an orphan record.
    if (disposed) return;
    outbox.save({
      batch: unackedEntries.map(e => ({ messageId: e.messageId, bytesHex: toHexBytes(e.bytes), notified: e.notified })),
      coverage: Object.fromEntries([...requestCoverage.entries()].map(([requestId, ids]) => [requestId, [...ids]])),
      queue: queuedEntries.map(e => ({ messageId: e.messageId, bytesHex: toHexBytes(e.bytes) })),
    });
  };

  // Coverage is pruned on an exact ACK or when the batch empties; a chat
  // whose batch rarely empties would otherwise accumulate (and persist)
  // entries for superseded statements the peer can never ACK. Older entries
  // are redundant for delivery-marking — every later submission covers the
  // full batch — so cap the map at the oldest end (Map preserves insertion
  // order).
  const MAX_COVERAGE_ENTRIES = 32;
  const pruneCoverage = () => {
    while (requestCoverage.size > MAX_COVERAGE_ENTRIES) {
      const oldest = requestCoverage.keys().next().value;
      if (oldest === undefined) break;
      requestCoverage.delete(oldest);
    }
  };
  pruneCoverage(); // restored records may predate the cap

  // All batch/queue mutations run through a single-slot pool so a user send
  // can't interleave with an ACK-triggered drain mid-trial-build. (The ACK
  // handler itself mutates batch/coverage synchronously BETWEEN ops' await
  // points — safe, because every post-await read in an op goes through the
  // live bindings, and an older ACK can never cover an op's in-flight
  // message.)
  const opPool = createAsyncTaskPool({ poolSize: 1 });
  const enqueueOp = <T>(op: () => Promise<T>): Promise<T> => opPool.call(op);

  // `justSubmitted` is captured BEFORE the submit await at each call site (the
  // not-yet-notified entries the statement carries). We notify those captured
  // refs rather than re-filtering `unackedEntries`, because an ACK can land
  // during the await: the in-memory path delivers to the peer synchronously and
  // the peer's ACK handler runs off the subscription OUTSIDE the op pool (see
  // the Response branch in the subscribe handler), removing entries from
  // `unackedEntries`. Re-deriving here would then drop their `onSent`.
  const notifySubmitted = (justSubmitted: UnackedEntry[]) => {
    if (disposed) return;
    // Flip + persist BEFORE invoking callbacks: if a callback (push
    // notification, status flip) crashes the app, the persisted `notified`
    // already reflects the submit, so restart can't double-fire it. The
    // inverse failure (persisted true, callback never ran) costs one missing
    // `sent` flip, which the later `delivered` transition supersedes.
    const pending = justSubmitted.filter(e => !e.notified);
    if (pending.length === 0) return;
    for (const entry of pending) entry.notified = true;
    persistOutbox();
    for (const entry of pending) onSent(entry.messageId);
  };

  const sendStatement = async (data: Uint8Array, channel: Uint8Array = outgoingChannel): Promise<void> => {
    await expiryFloorSynced;
    const outerEnc = outgoingEncryption.encrypt(data);
    if (outerEnc.isErr()) throw outerEnc.error;
    await transportGateway.signAndSubmitStatement({
      prover,
      allocator: expiryAllocator,
      statementStore,
      channel,
      topics: outgoingTopic,
      data: outerEnc.value,
      logTag: 'chat-session-v2',
    });
  };

  // Trial-build the exact bytes a submit would carry: inner SingleRequest →
  // MultiRequest envelope (per-device key fan-out) → outer K(D(A),B) layer.
  // The budget is enforced on these FINAL encrypted bytes — measuring any
  // inner layer undercounts the per-device overhead that grows with the
  // peer's roster. On the happy path the returned bytes ARE submitted, so
  // the trial costs nothing extra.
  const buildEnvelope = (entries: { messageId: string; bytes: Uint8Array }[], requestId: string): Uint8Array => {
    const inner = SingleRequest.enc({ requestId, messages: entries.map(e => e.bytes) });
    const { data } = multiDeviceService.encryptForRecipients(
      inner,
      peerDevices.map(d => ({ statementAccountId: d.statementAccountId, encryptionPublicKey: d.encryptionPublicKey })),
      ownDeviceEncryptionPrivateKey,
    );
    const outerEnc = outgoingEncryption.encrypt(data);
    if (outerEnc.isErr()) throw outerEnc.error;
    return outerEnc.value;
  };

  const submitEncrypted = async (encrypted: Uint8Array): Promise<void> => {
    await expiryFloorSynced;
    await transportGateway.signAndSubmitStatement({
      prover,
      allocator: expiryAllocator,
      statementStore,
      channel: outgoingChannel,
      topics: outgoingTopic,
      data: encrypted,
      logTag: 'chat-session-v2',
    });
  };

  // Retry handle for transient drain-submit failures. Without it, a failed
  // drain leaves never-submitted entries in the batch with an EMPTY queue —
  // a state no peer ACK can ever drain (the peer never saw the statement)
  // and no user action is pending. One-shot; each failed attempt schedules
  // the next. Cleared on dispose.
  const DRAIN_RETRY_DELAY_MS = 30_000;
  let drainRetryTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleDrainRetry = () => {
    if (disposed || drainRetryTimer !== null) return;
    drainRetryTimer = setTimeout(() => {
      drainRetryTimer = null;
      void drainQueue();
    }, DRAIN_RETRY_DELAY_MS);
  };

  /**
   * Submit ONE fresh statement carrying the whole batch plus every parked
   * message the budget allows. Triggered by: a peer ACK (budget freed),
   * session start (restored queue / never-submitted restored batch), any
   * parked send (retry after a DataTooLarge rollback, which can leave an
   * empty batch with a non-empty queue — a state no ACK would ever drain),
   * and a timer retry after a transient submit failure. Also re-ships batch
   * entries that have never been on a successfully submitted statement
   * (`notified: false` — exactly what a transient submit failure leaves
   * behind). Never throws: drain has no caller to surface errors to; entries
   * stay batched/queued for the next trigger.
   */
  const drainQueue = (): Promise<void> =>
    enqueueOp(async () => {
      if (disposed) return;
      const hasUnsubmitted = unackedEntries.some(e => !e.notified);
      if (queuedEntries.length === 0 && !hasUnsubmitted) return;

      const requestId = nanoid();
      // Build phase — NO state mutation, so a buildEnvelope throw leaves the
      // batch and queue exactly as they were (shifting heads off the queue
      // before the commit used to lose them when a later iteration threw).
      const moved: UnackedEntry[] = [];
      const undeliverableIds = new Set<string>();
      let encrypted: Uint8Array | null = null;
      try {
        for (const head of queuedEntries) {
          const candidate = [...unackedEntries, ...moved, { messageId: head.messageId, bytes: head.bytes }];
          const trial = buildEnvelope(candidate, requestId);
          if (trial.length <= maxStatementDataBytes) {
            // notified:false is correct by construction — queued entries have
            // never been on a successfully submitted statement (send parks
            // them before submit; the DataTooLarge net rolls them back
            // pre-ack).
            moved.push({ messageId: head.messageId, bytes: head.bytes, notified: false });
            encrypted = trial;
            continue;
          }
          if (unackedEntries.length + moved.length > 0) break;
          // The head exceeds the budget ALONE: it can never ship, and strict
          // FIFO would wedge every message behind it forever (it parked when
          // it still fit — e.g. the peer's device roster has grown since,
          // and each extra device grows the envelope). Drop it, surface to
          // the manager, and consider the next head.
          undeliverableIds.add(head.messageId);
        }
        // A transient submit failure leaves never-submitted entries in the
        // batch; if no queued message fits on top, re-ship the batch alone.
        if (encrypted === null && hasUnsubmitted) {
          const trial = buildEnvelope(unackedEntries, requestId);
          if (trial.length <= maxStatementDataBytes) encrypted = trial;
        }
      } catch (err) {
        console.warn('[chat-session-v2] drain envelope build failed — batch and queue retained: %o', err);
        return;
      }

      // Commit phase — the build can no longer throw.
      if (undeliverableIds.size > 0) {
        queuedEntries = queuedEntries.filter(e => !undeliverableIds.has(e.messageId));
        for (const messageId of undeliverableIds) {
          console.warn(
            '[chat-session-v2] parked message %s no longer fits a statement alone (budget=%d) — dropped as undeliverable',
            messageId,
            maxStatementDataBytes,
          );
          onUndeliverable?.(messageId);
        }
      }
      if (encrypted === null) {
        if (undeliverableIds.size > 0) persistOutbox();
        return;
      }

      const movedIds = new Set(moved.map(m => m.messageId));
      queuedEntries = queuedEntries.filter(e => !movedIds.has(e.messageId));
      unackedEntries = [...unackedEntries, ...moved];
      requestCoverage.set(requestId, new Set(unackedEntries.map(e => e.messageId)));
      pruneCoverage();
      persistOutbox();
      // Snapshot what this submit marks `sent` BEFORE awaiting — an ACK racing
      // in during the await must not erase these entries' onSent.
      const justSubmitted = unackedEntries.filter(e => !e.notified);
      try {
        await submitEncrypted(encrypted);
      } catch (err) {
        requestCoverage.delete(requestId);
        if (err instanceof DataTooLargeError) {
          // Roll the moved entries back to the queue FRONT (order preserved).
          unackedEntries = unackedEntries.filter(e => !movedIds.has(e.messageId));
          queuedEntries = [...moved.map(({ messageId, bytes }) => ({ messageId, bytes })), ...queuedEntries];
          console.warn(
            '[chat-session-v2] drain hit DataTooLarge (submitted=%d available=%d) — %d message(s) re-parked',
            err.submitted,
            err.available,
            moved.length,
          );
        } else {
          console.warn('[chat-session-v2] drain submit failed — batch retained, retry scheduled: %o', err);
          scheduleDrainRetry();
        }
        persistOutbox();
        return;
      }
      notifySubmitted(justSubmitted);
    });

  // Post a success ACK for a request we just decoded, so the peer can advance
  // its own outgoing message `sent → delivered`. Fire-and-forget: we never
  // block message handling on the ack submission. Mirrors iOS, which acks
  // after a successful decrypt+decode of the request (not after the user reads).
  const sendAck = async (requestId: string): Promise<void> => {
    if (peerDevices.length === 0) return;
    const inner = SingleResponse.enc({ requestId, responseCode: 0 });
    const { data } = multiDeviceService.encryptResponseForRecipients(
      inner,
      peerDevices.map(d => ({ statementAccountId: d.statementAccountId, encryptionPublicKey: d.encryptionPublicKey })),
      ownDeviceEncryptionPrivateKey,
    );
    await sendStatement(data, outgoingResponseChannel);
  };

  const send = async (
    content: CodecType<typeof ChatMessageCodec>['versioned']['value'],
    opts?: { messageId?: string; timestamp?: number },
  ) => {
    if (peerDevices.length === 0) {
      throw new Error('[chat-session-v2] cannot send: peer device roster is empty');
    }

    const messageId = opts?.messageId ?? nanoid(12);
    const timestamp = opts?.timestamp ?? Date.now();

    console.info(
      '[DEVICE-TRACE] chat-session-v2 SEND message:\n  messageId=%s\n  contentTag=%s\n  topic=%s\n  ownDevice.stmtAcct=%s\n  peerIdentityAcct=%s\n  encrypting MultiRequest for %d peer device(s)=%o',
      messageId,
      content.tag,
      toHex(outgoingTopic),
      toHex(ownDeviceStatementAccountId),
      toHex(peerIdentityAccountId),
      peerDevices.length,
      peerDevices.map(d => ({
        stmtAcct: toHex(d.statementAccountId),
        encPub: toHex(d.encryptionPublicKey),
      })),
    );

    const chatMsg = ChatMessageCodec.enc({
      messageId,
      timestamp: BigInt(timestamp),
      versioned: { tag: 'v1', value: content },
    });

    const parked = await enqueueOp(async (): Promise<boolean> => {
      // A message that can never fit any statement fails loudly instead of
      // bricking the queue (FIFO would block everything behind it forever).
      // The candidate check below subsumes this when the batch is empty.
      const ensureFitsAlone = () => {
        const aloneSize = buildEnvelope([{ messageId, bytes: chatMsg }], nanoid()).length;
        if (aloneSize > maxStatementDataBytes) throw createMessageTooLargeError(aloneSize, maxStatementDataBytes);
      };

      // FIFO strictness: once anything is parked, every later message parks.
      if (queuedEntries.length > 0) {
        ensureFitsAlone();
        queuedEntries.push({ messageId, bytes: chatMsg });
        persistOutbox();
        return true;
      }

      // `messages` carries the FULL unacked batch (this message appended
      // last) — the new statement supersedes the previous one on this
      // channel, so it must contain everything the peer hasn't acked yet.
      const requestId = nanoid();
      const candidate = [...unackedEntries, { messageId, bytes: chatMsg, notified: false }];
      const encrypted = buildEnvelope(candidate, requestId);
      if (encrypted.length > maxStatementDataBytes) {
        if (unackedEntries.length === 0) throw createMessageTooLargeError(encrypted.length, maxStatementDataBytes);
        ensureFitsAlone();
        // First entry into parked mode — the early-warning signal that the
        // unacked batch has outgrown the statement budget (an offline peer).
        console.warn(
          '[chat-session-v2] batch at the statement budget (%d > %d bytes, %d unacked) — message %s parked',
          encrypted.length,
          maxStatementDataBytes,
          unackedEntries.length,
          messageId,
        );
        queuedEntries.push({ messageId, bytes: chatMsg });
        persistOutbox();
        return true;
      }

      unackedEntries = candidate;
      requestCoverage.set(requestId, new Set(candidate.map(e => e.messageId)));
      pruneCoverage();
      persistOutbox();
      // Snapshot what this submit marks `sent` BEFORE awaiting — an ACK racing
      // in during the await must not erase these entries' onSent.
      const justSubmitted = unackedEntries.filter(e => !e.notified);
      try {
        await submitEncrypted(encrypted);
      } catch (err) {
        // The coverage entry maps a requestId the peer will never see (the
        // statement didn't land) — delete it or it leaks forever. The message
        // itself STAYS batched: it is legitimately unacked and rides the next
        // statement; its onSent fires when one finally lands.
        requestCoverage.delete(requestId);
        if (err instanceof DataTooLargeError) {
          // Safety net: the local gate passed but the chain refused. Park
          // instead of failing the send, and log the authoritative budget so
          // MAX_STATEMENT_DATA_BYTES can be corrected.
          unackedEntries = unackedEntries.filter(e => e.messageId !== messageId);
          queuedEntries.unshift({ messageId, bytes: chatMsg });
          persistOutbox();
          console.warn(
            '[chat-session-v2] DataTooLarge past the local gate (submitted=%d available=%d) — message %s parked',
            err.submitted,
            err.available,
            messageId,
          );
          return true;
        }
        persistOutbox();
        // The message stays batched (notified:false); the retry timer
        // re-ships it even if the user never sends again — without it, a
        // transient submit failure on the LAST message of a conversation
        // would sit at `new` until restart.
        scheduleDrainRetry();
        throw err;
      }
      notifySubmitted(justSubmitted);
      return false;
    });

    // Drain OUTSIDE the mutex op (drainQueue enqueues its own op — calling it
    // inside would deadlock the chain). Self-healing: a park can leave the
    // queue non-empty while the batch has room (DataTooLarge net), and only
    // a new trigger ships it.
    if (parked) void drainQueue();

    return { messageId, timestamp, parked };
  };

  // ── Incoming: subscribe per peer device D(B') ────────────────────────────
  // Each peer device has its own topic. The outer key K(D(B'),A) is derived
  // on our side as ECDH(ownIdentityChatPriv, peerDevice.encPub).

  const incomingUnsubs: VoidFunction[] = [];

  const tryDecodeInnerSingleRequest = (
    outer: ReturnType<typeof StructuredStatementData.dec>,
    peerDeviceEncPub: Uint8Array,
  ): CodecType<typeof SingleRequest> | null => {
    if (outer.tag === 'MultiRequest') {
      const envelope = outer.value;
      const ownEntry = envelope.devicesInfo.find(d => {
        if (d.statementAccountId.length !== ownDeviceStatementAccountId.length) return false;
        for (let i = 0; i < d.statementAccountId.length; i++) {
          if (d.statementAccountId[i] !== ownDeviceStatementAccountId[i]) return false;
        }
        return true;
      });
      console.info(
        '[chat-session-v2 INNER-DECODE] ownStatementAccountId=%s devicesInfoCount=%d devicesInfo.accountIds=%o foundEntry=%s',
        toHex(ownDeviceStatementAccountId),
        envelope.devicesInfo.length,
        envelope.devicesInfo.map(d => toHex(d.statementAccountId)),
        ownEntry ? 'YES' : 'NO',
      );
      if (!ownEntry) {
        console.warn('[chat-session-v2] MultiRequest envelope has no entry for own device — dropping');
        return null;
      }
      let oneShotKey: Uint8Array;
      try {
        oneShotKey = multiDeviceService.unwrapOneShotKey(ownDeviceEncryptionPrivateKey, peerDeviceEncPub, ownEntry.encryptedKey);
      } catch (e) {
        console.warn('[chat-session-v2] MultiRequest per-device unwrap failed', e);
        return null;
      }
      let innerBytes: Uint8Array;
      try {
        innerBytes = multiDeviceService.aesGcmDecrypt(oneShotKey, envelope.encryptedRequest);
      } catch (e) {
        console.warn('[chat-session-v2] MultiRequest inner AES decrypt failed', e);
        return null;
      }
      try {
        return SingleRequest.dec(innerBytes);
      } catch (e) {
        const innerFirstBytes = toHex(innerBytes.slice(0, Math.min(32, innerBytes.length)));
        console.warn(
          '[chat-session-v2] MultiRequest inner SingleRequest decode failed innerLen=%d firstBytes=%s err=%s',
          innerBytes.length,
          innerFirstBytes,
          e instanceof Error ? e.message : String(e),
        );
        return null;
      }
    }

    if (outer.tag === 'Request') {
      // Backward-compat: V1 sender emitted a plain SingleRequest under the
      // outer pairwise encryption. The spec-aligned send path won't produce
      // this, but receive still accepts it during the cross-platform rollout.
      return outer.value;
    }

    // A Response/MultiResponse — handled by tryDecodeInnerSingleResponse.
    return null;
  };

  const tryDecodeInnerSingleResponse = (
    outer: ReturnType<typeof StructuredStatementData.dec>,
    peerDeviceEncPub: Uint8Array,
  ): CodecType<typeof SingleResponse> | null => {
    if (outer.tag === 'MultiResponse') {
      const envelope = outer.value;
      const ownEntry = envelope.devicesInfo.find(d => p2pService.bytesEqual(d.statementAccountId, ownDeviceStatementAccountId));
      if (!ownEntry) return null;
      let oneShotKey: Uint8Array;
      try {
        oneShotKey = multiDeviceService.unwrapOneShotKey(ownDeviceEncryptionPrivateKey, peerDeviceEncPub, ownEntry.encryptedKey);
      } catch (e) {
        console.warn('[chat-session-v2] MultiResponse per-device unwrap failed', e);
        return null;
      }
      let innerBytes: Uint8Array;
      try {
        innerBytes = multiDeviceService.aesGcmDecrypt(oneShotKey, envelope.encryptedResponse);
      } catch (e) {
        console.warn('[chat-session-v2] MultiResponse inner AES decrypt failed', e);
        return null;
      }
      try {
        return SingleResponse.dec(innerBytes);
      } catch (e) {
        console.warn('[chat-session-v2] MultiResponse inner SingleResponse decode failed', e);
        return null;
      }
    }

    if (outer.tag === 'Response') {
      // Backward-compat: V1 single-device pairwise response.
      return outer.value;
    }

    return null;
  };

  const processStatement = (
    statement: Statement,
    peerDeviceEncPub: Uint8Array,
    peerDeviceStatementAccountId: Uint8Array,
    incomingEncryption: ReturnType<typeof createEncryption>,
  ) => {
    if (disposed) return;
    if (!statement.data) return;
    const sigKey = toHex(statement.data);
    if (seenStatementIds.has(sigKey)) return;
    seenStatementIds.add(sigKey);

    const outerDec = incomingEncryption.decrypt(statement.data);
    if (outerDec.isErr()) {
      const rawTopic = statement.topics?.[0];
      const topicShort =
        typeof rawTopic === 'string' ? rawTopic.slice(0, 18) : rawTopic ? toHex(rawTopic).slice(0, 18) : '<none>';
      console.warn(
        '[chat-session-v2 OUTER-DECRYPT FAILED] topic=%s dataLen=%d peerDevice=%s err=%o',
        topicShort + '...',
        statement.data.length,
        toHex(peerDeviceStatementAccountId).slice(0, 18) + '...',
        outerDec.error,
      );
      return;
    }
    const decrypted = outerDec.value;

    let outer: ReturnType<typeof StructuredStatementData.dec>;
    try {
      outer = StructuredStatementData.dec(decrypted);
    } catch (e) {
      // Outer decrypt succeeded, so K(D(B'),A) is correct — peer is genuine.
      // Decode still fell over, so the plaintext shape doesn't match our
      // `StructuredStatementData` codec. Dump enough to tell from a single log
      // line whether: (a) the discriminant byte is out of range (pre-spec
      // wrapper), (b) PApp sent a bare struct without the dispatcher, or
      // (c) the inner length prefix is junk (codec drift).
      const discriminant = decrypted[0];
      const discriminantName =
        discriminant === 0
          ? 'Request'
          : discriminant === 1
            ? 'Response'
            : discriminant === 2
              ? 'MultiRequest'
              : discriminant === 3
                ? 'MultiResponse'
                : `OUT_OF_RANGE(${discriminant})`;
      const firstBytes = toHex(decrypted.slice(0, Math.min(32, decrypted.length)));
      console.warn(
        '[chat-session-v2] StructuredStatementData decode failed peerDeviceEncPub=%s decryptedLen=%d discriminant=%s firstBytes=%s err=%s',
        toHex(peerDeviceEncPub),
        decrypted.length,
        discriminantName,
        firstBytes,
        e instanceof Error ? e.message : String(e),
      );
      return;
    }
    console.info('[chat-session-v2 STRUCT-DECODE OK] decryptedLen=%d tag=%s', decrypted.length, outer.tag);

    if (outer.tag === 'Response' || outer.tag === 'MultiResponse') {
      const response = tryDecodeInnerSingleResponse(outer, peerDeviceEncPub);
      if (!response) return;
      // The peer acks one requestId; that submission carried a snapshot of
      // the unacked batch. Mark exactly those messages delivered and drop
      // them from the batch — later submissions' coverage still tracks any
      // messages added after that snapshot.
      const covered = requestCoverage.get(response.requestId);
      if (covered === undefined) return;
      requestCoverage.delete(response.requestId);
      // Deliver only what is still in the batch — anything already dropped
      // was delivered by an earlier ack.
      unackedEntries = unackedEntries.filter(entry => {
        if (!covered.has(entry.messageId)) return true;
        onDelivered(entry.messageId);
        return false;
      });
      if (unackedEntries.length === 0) {
        // Nothing left in flight — older snapshots can't mark anything new.
        requestCoverage.clear();
      }
      persistOutbox();
      // Budget just freed — ship parked messages. Async-enqueued; this
      // handler stays sync.
      void drainQueue();
      return;
    }

    const request = tryDecodeInnerSingleRequest(outer, peerDeviceEncPub);
    if (!request) return;

    for (const msgBytes of request.messages) {
      let chatMsg: CodecType<typeof ChatMessageCodec>;
      try {
        chatMsg = ChatMessageCodec.dec(msgBytes);
      } catch (e) {
        console.warn('[chat-session-v2] ChatMessage decode failed', e);
        continue;
      }
      if (seenMessageIds.has(chatMsg.messageId)) continue;
      seenMessageIds.add(chatMsg.messageId);
      onMessage({
        messageId: chatMsg.messageId,
        timestamp: Number(chatMsg.timestamp),
        content: chatMsg.versioned.value,
      });
    }

    // ACK the request now that it decoded cleanly, so the peer can advance its
    // outgoing message to `delivered`. Fire-and-forget — message handling above
    // already happened and must not block on the ack submission.
    void sendAck(request.requestId).catch(e => console.warn('[chat-session-v2] sendAck failed', e));
  };

  console.info(
    '[chat-session-v2 SUBSCRIBE] contact peerIdentity=%s peerDevicesCount=%d devices=%o',
    toHex(peerIdentityAccountId),
    peerDevices.length,
    peerDevices.map(d => ({
      statementAccountId: toHex(d.statementAccountId),
      encryptionPublicKey: toHex(d.encryptionPublicKey).slice(0, 18) + '...',
    })),
  );

  for (const peerDevice of peerDevices) {
    const incomingSharedSecret = p2pService.computeSharedSecret(identityChatPrivateKey, peerDevice.encryptionPublicKey);
    const incomingEncryption = createEncryption(incomingSharedSecret);

    const remoteDevice = { accountId: createAccountId(peerDevice.statementAccountId), pin: undefined };
    const incomingTopic = createSessionId(incomingSharedSecret, remoteDevice, localIdentity);

    console.info(
      '[MDSTEST topics RECEIVE] topic=%s\n  peerDeviceStmtAcct=%s\n  ownIdentityAcct=%s\n  peerDeviceEncPub=%s\n  sharedSecret=%s',
      toHex(incomingTopic),
      toHex(peerDevice.statementAccountId),
      toHex(ownIdentityAccountId),
      toHex(peerDevice.encryptionPublicKey),
      toHex(incomingSharedSecret),
    );

    const unsub = trackedSubscribeStatements(statementStore, { matchAll: [incomingTopic] }, ({ statements }) => {
      console.info(
        '[chat-session-v2 RECV] topic=%s peerDevice=%s receivedStatements=%d',
        toHex(incomingTopic),
        toHex(peerDevice.statementAccountId),
        statements.length,
      );
      for (const stmt of statements)
        processStatement(stmt, peerDevice.encryptionPublicKey, peerDevice.statementAccountId, incomingEncryption);
    });
    incomingUnsubs.push(unsub);

    // Catch-up on history for this peer device.
    void statementStore.queryStatements({ matchAll: [incomingTopic] }).match(
      statements => {
        for (const stmt of statements)
          processStatement(stmt, peerDevice.encryptionPublicKey, peerDevice.statementAccountId, incomingEncryption);
      },
      err => console.warn('[chat-session-v2] queryStatements failed', err),
    );
  }

  // Ship whatever the restored state allows: covers "peer ACKed while the
  // app was closed" (catch-up will also re-trigger on the ack), a queue
  // restored against an empty batch, and a restored batch whose statement
  // never landed (notified:false — a pre-restart transient submit failure).
  void drainQueue();

  return {
    send,
    dispose: () => {
      disposed = true;
      if (drainRetryTimer !== null) {
        clearTimeout(drainRetryTimer);
        drainRetryTimer = null;
      }
      for (const unsub of incomingUnsubs) unsub();
      incomingUnsubs.length = 0;
    },
  };
};
