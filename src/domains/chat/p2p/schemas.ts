import * as v from 'valibot';

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

const MessagePositionSchema = v.object({ timestamp: v.number(), messageId: v.string() });

export const P2PRoomSchema = v.object({
  sessionId: v.string(),
  peerId: v.string(),
  peerUsername: v.string(),
  userId: v.string(),
  createdAt: v.number(),
  peerPushToken: v.optional(v.string()),
  peerPlatform: v.optional(PlatformSchema),
  // Mirrors Android's Contact.isBlocked. Optional + defaulted to false so existing
  // Dexie rows from before this field was added decode as unblocked without a
  // schema bump (the field is not indexed).
  isBlocked: v.optional(v.boolean()),
  // RFC 0006 `peerSeenOrder` and `lastSentSeen`: how far the peer has seen our messages, and
  // the last message we reported seen to the peer. Both are device-local, only advance, and are
  // written without stamping `lastUpdate`, so device-sync never collects them.
  peerSeen: v.optional(MessagePositionSchema),
  lastSentSeen: v.optional(MessagePositionSchema),
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
  // request can't resurface after the user wipes a chat. UI lists never show
  // 'removed'; they show 'cancelled' only through `cancelledIncoming`. 'cancelled' is a tombstone too:
  // written on the sender when it cancels, and on the receiver when a valid
  // cancel arrives (RFC 0007), so a later copy of the request cannot bring it back.
  status: v.picklist(['pending', 'accepted', 'declined', 'removed', 'cancelled']),
  welcomeMessage: v.optional(v.string()),
  // Per-request "View message" reveal flag. Incoming requests hide their
  // welcome message by default (see `request-preferences`); once the user
  // reveals it this is set true and persists across reloads. Optional so
  // rows that pre-date the column keep decoding (treated as not revealed).
  revealed: v.optional(v.boolean()),
  timestamp: v.number(),
  channelTopic: v.optional(v.string()),
  userId: v.string(),
  pushToken: v.optional(v.string()),
  pushPlatform: v.optional(PlatformSchema),
  /**
   * Hex-encoded X25519 (32 bytes) public key the sender device uses for
   * key-agreement-derived per-device key wrapping. Populated only on V2 chat
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
