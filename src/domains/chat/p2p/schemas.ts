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
