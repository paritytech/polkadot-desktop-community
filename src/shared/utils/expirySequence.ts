/**
 * Process-monotonic sequence counter for the low 32 bits of a statement-store
 * `expiry` value (`expiry = (timestampSecs << 32) | sequenceNumber`).
 *
 * Why this is shared across the entire renderer process: the bulletin
 * statement-store enforces strict-greater-than priority per account. Two
 * submits that produce the same 64-bit expiry land as
 * `accountFull: submitted == min`. The timestamp half has 1-second
 * resolution, so any two same-second submits from the same account need
 * distinct sequence numbers to avoid the tie.
 *
 * Both the device-sync transport and the chat statement-submit helpers
 * sign with the *same* device key, so their submits compete for the same
 * account slot. Each used to maintain its own module-local counter starting
 * at 1 — same-second submits from both paths therefore picked `seq=1`
 * independently and racing submits got rejected as ties. Routing both
 * through this single counter keeps every submit's expiry unique within a
 * second regardless of which subsystem queued it.
 */

let nextSequenceNumber = 1;

export function takeExpirySequenceNumber(): number {
  const seq = nextSequenceNumber;
  // 32-bit wrap-around so we never violate the SDK's `[0, 2^32)` constraint.
  nextSequenceNumber = (nextSequenceNumber + 1) >>> 0;
  if (nextSequenceNumber === 0) nextSequenceNumber = 1;
  return seq;
}
