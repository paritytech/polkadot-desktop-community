import * as v from 'valibot';

import { hexString } from '@/shared/types';

// `hexString` only checks the `0x` prefix, and polkadot-api `fromHex` does NOT
// throw on undecodable input — it silently maps non-hex chars to garbage bytes.
// Without real hex validation a corrupt record would be "restored" into junk
// statement bytes instead of degrading to a clean start, so enforce
// even-length canonical hex at this boundary.
const strictHexString = v.pipe(hexString, v.regex(/^0x(?:[0-9a-f]{2})*$/iu, 'must be even-length hex'));

/**
 * Persisted V2 outbox record — one per (user, peer) in localStorage. Read
 * back across app restarts, so it crosses a trust boundary and must be
 * schema-validated on load (a corrupt record degrades to a clean start, it
 * must never crash the session).
 *
 * - `batch` mirrors the session's in-memory `unackedEntries` (every message
 *   the peer hasn't ACKed; all carried by the latest statement). `notified`
 *   = "onSent already fired" so a crash between persist and submit neither
 *   loses nor double-fires the `sent` flip.
 * - `coverage` mirrors `requestCoverage` (requestId → messageIds that
 *   submission carried), so a peer ACK for a pre-restart requestId still
 *   marks exactly the right messages delivered.
 * - `queue` is the FIFO of parked messages that didn't fit the statement
 *   budget. `bytesHex` is the SCALE-encoded ChatMessage (self-contained:
 *   messageId, timestamp, content).
 */
export const OutboxRecordSchema = v.object({
  batch: v.array(v.object({ messageId: v.string(), bytesHex: strictHexString, notified: v.boolean() })),
  coverage: v.record(v.string(), v.array(v.string())),
  queue: v.array(v.object({ messageId: v.string(), bytesHex: strictHexString })),
});

export type OutboxRecord = v.InferOutput<typeof OutboxRecordSchema>;

// ── Persisted Dexie rows ─────────────────────────────────────────────────
// Rows read back from IndexedDB cross a trust boundary (the store can be
// corrupted, hand-edited via DevTools, or written by a different app
// version). Reads in `resource.ts` filter rows through these schemas —
// a corrupt row degrades to "skipped + warn", it must never crash a stream.
//
// Validation uses `v.is` (boolean check, no transformation), so the original
// row object is kept — nothing is stripped or defaulted on a path that may
// be written back to Dexie later.

const PlatformSchema = v.picklist(['Android', 'iOS']);

export const P2PRoomSchema = v.object({
  sessionId: v.string(),
  peerId: v.string(),
  peerUsername: v.string(),
  peerP256PublicKey: v.string(),
  userId: v.string(),
  createdAt: v.number(),
  peerPushToken: v.optional(v.string()),
  peerPlatform: v.optional(PlatformSchema),
  // Mirrors Android's Contact.isBlocked. Optional + defaulted to false so existing
  // Dexie rows from before this field was added decode as unblocked without a
  // schema bump (the field is not indexed).
  isBlocked: v.optional(v.boolean()),
  // Optional with a default: rows that pre-date the `lastUpdate` column must
  // keep decoding (they sort as "changed before everything").
  lastUpdate: v.optional(v.number(), 0),
});

export type P2PRoom = v.InferOutput<typeof P2PRoomSchema>;

export const P2PChatRequestSchema = v.object({
  requestId: v.string(),
  peerId: v.string(),
  peerUsername: v.optional(v.string()),
  direction: v.picklist(['incoming', 'outgoing']),
  // 'removed' is a tombstone written by `removeSession` so a stale on-chain
  // request can't resurface after the user wipes a chat. UI lists filter to
  // 'pending'/'accepted'/'declined' as before.
  status: v.picklist(['pending', 'accepted', 'declined', 'removed']),
  welcomeMessage: v.optional(v.string()),
  timestamp: v.number(),
  channelTopic: v.optional(v.string()),
  userId: v.string(),
  pushToken: v.optional(v.string()),
  pushPlatform: v.optional(PlatformSchema),
  /**
   * Hex-encoded P-256 (uncompressed, 65 bytes) public key the sender device
   * uses for ECDH-derived per-device key wrapping. Populated only on V2 chat
   * requests; absent for V1 single-device requests.
   */
  senderDevicePubKey: v.optional(v.string()),
  /**
   * Hex-encoded sr25519 (32 bytes) statementAccountId of the sender device —
   * the `RemoteModel.proof.signer` of the V2 chat request. Populated only on
   * V2 chat requests. Used as `Contact.devices[].statementAccountId` and as
   * the `RequestDeviceInfo.statementAccountId` key in MultiRequest envelopes.
   */
  senderDeviceStatementAccountId: v.optional(v.string()),
  lastUpdate: v.optional(v.number(), 0),
});

export type P2PChatRequest = v.InferOutput<typeof P2PChatRequestSchema>;

// Envelope-only guard for persisted `ChatMessage` rows. The `content` union
// (`MessageContent` in `chat/session/types`) is SDK-shaped and consumed
// defensively by the content mappers, so only the envelope fields that
// queries and the notification path rely on are validated here.
export const PersistedChatMessageSchema = v.looseObject({
  messageId: v.string(),
  sessionId: v.string(),
  timestamp: v.number(),
  content: v.looseObject({ type: v.string() }),
  status: v.union([
    v.looseObject({ direction: v.literal('outgoing'), state: v.picklist(['new', 'sent', 'delivered']) }),
    v.looseObject({ direction: v.literal('incoming'), state: v.picklist(['new', 'seen']) }),
  ]),
});
