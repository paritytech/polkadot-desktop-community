/**
 * Adapter mapping orchestrator's `postStatement` / `subscribeStatementTopic`
 * ports onto `statementStoreAdapter`. Statements are signed by the device's
 * sr25519 (key whose pubkey is `statementAccountId`); a single 32-byte
 * khash-derived pair topic per direction, `matchAll: [topic]` on subscribe.
 */

import {
  PRIORITY_EPOCH_OFFSET,
  createExpiryAllocator,
  createSr25519Prover,
  signAndSubmitStatement,
} from '@novasamatech/statement-store';
import { fromHex, toHex } from 'polkadot-api/utils';
import { Observable } from 'rxjs';

import { statementStoreAdapter } from '@/domains/application';

// Legacy receive-side constant: statements written by old clients encode
// `(submissionSecs + EXPIRY_DURATION_SECS) << 32 | seq`. Kept only to
// age-filter those statements during the transition (see
// submissionSecsFromExpiry); new submits use the pinned-high allocator.
const EXPIRY_DURATION_SECS = 7 * 24 * 60 * 60;

// AccountFull / ExpiryTooLow can clear themselves once existing statements
// roll off the account's slot window — a short backoff is usually enough.
// We retry transparently so a single failure on a multi-fragment send (like
// trickling ICE candidates) doesn't strand the signaler. Non-priority errors
// (`attempts: 0`) propagate immediately to the orchestrator.
const RETRY_DELAYS_MS = [500, 1500, 3000];

export type DeviceSyncTransport = {
  /**
   * `channel` is required: the store keeps ONE statement per
   * (account, channel), so channelled posts replace their predecessor instead
   * of eating a fresh account slot. Channel-less posts would accumulate until
   * the account's slot budget is exhausted, after which every new submit
   * EVICTS the account's oldest statement — including unrelated ones (e.g. a
   * signaling Offer evicted by its own trailing ICE candidates).
   */
  postStatement: (topic: Uint8Array, data: Uint8Array, channel: Uint8Array) => Promise<void>;
  subscribeStatementTopic: (topic: Uint8Array) => Observable<{ topic: Uint8Array; data: Uint8Array; signer: Uint8Array }>;
};

/**
 * Submission second of a statement, derived from its expiry under either
 * layout. Pinned-high (current clients): the low word is seconds since the
 * 2025-11-15 priority epoch — a floor-bumped low word can only make a
 * statement look NEWER, which errs toward keeping it. Legacy: the high word
 * is `submissionSecs + EXPIRY_DURATION_SECS`.
 * Accepted trade-off: a peer whose allocator floor ran far ahead of wall
 * clock bypasses this age filter entirely (derived submission in the future),
 * re-admitting replayed signaling from that peer. The symmetric alternative
 * (drop future-dated too) would permanently silence such a peer's FRESH
 * signaling instead — strictly worse; replay thrash is transient and
 * self-corrects via per-channel supersession.
 */
export function submissionSecsFromExpiry(expiry: bigint): number {
  const high = Number(expiry >> 32n);
  if (high === 0xffff_ffff) return Number((expiry & 0xffff_ffffn) + PRIORITY_EPOCH_OFFSET);
  return high - EXPIRY_DURATION_SECS;
}

export function createDeviceSyncTransport(deviceStatementAccountSeed: Uint8Array): DeviceSyncTransport {
  const prover = createSr25519Prover(deviceStatementAccountSeed);
  // One expiry source for this transport's submits. `signAndSubmitStatement`
  // draws from it on every attempt and adopts the chain-reported floor
  // (`error.min`) into it on each priority rejection, so the next retry signs
  // strictly above the chain minimum.
  const priority = createExpiryAllocator();

  // Expiry synchronization (the session spec's init step): before the first
  // submit to a topic, seed the shared allocator's floor from our own statements
  // already live on it. Signaling from a previous app session survives in the
  // store (pinned-high expiries never lapse), so a fresh allocator (floor 0)
  // signs at the wall-clock priority and ties/loses to that surviving statement,
  // bouncing through priority-rejection retries before it clears (and, before
  // the SDK's lossless-expiry fix, never clearing at all). Memoized per topic;
  // raiseFloor is monotonic, so the one shared allocator converges to the max
  // across every peer's channel.
  const floorSyncByTopic = new Map<string, Promise<void>>();
  const syncExpiryFloor = async (topic: Uint8Array): Promise<void> => {
    const result = await statementStoreAdapter.queryStatements({ matchAll: [topic] });
    if (result.isErr()) {
      console.warn('WEBRTC [transport] expiry-floor sync failed for topic=%s: %s', toHex(topic), result.error.message);
      return;
    }
    let maxExpiry = 0n;
    for (const s of result.value) {
      if (s.expiry !== undefined && s.expiry > maxExpiry) maxExpiry = s.expiry;
    }
    priority.raiseFloor(maxExpiry);
  };
  const ensureFloorSynced = (topic: Uint8Array): Promise<void> => {
    const topicHex = toHex(topic);
    let pending = floorSyncByTopic.get(topicHex);
    if (!pending) {
      pending = syncExpiryFloor(topic);
      floorSyncByTopic.set(topicHex, pending);
    }
    return pending;
  };

  const postStatement = async (topic: Uint8Array, data: Uint8Array, channel: Uint8Array): Promise<void> => {
    await ensureFloorSynced(topic);
    const result = await signAndSubmitStatement({
      statementStore: statementStoreAdapter,
      prover,
      allocator: priority,
      channel,
      topics: [topic],
      data,
      retry: {
        attempts: 0, // non-priority errors propagate immediately
        priorityAttempts: RETRY_DELAYS_MS.length,
        delaysMs: RETRY_DELAYS_MS,
        onPriorityError(error) {
          priority.raiseFloor(error.min);
        },
        onRetry({ attempt, delayMs, error }) {
          console.warn(
            'WEBRTC [transport] submit transient failure for topic=%s attempt=%d will retry in %dms: %s',
            toHex(topic),
            attempt,
            delayMs,
            error.message,
          );
        },
      },
    });

    if (result.isErr()) {
      console.error('WEBRTC [transport] submit failed for topic=%s: %s', toHex(topic), result.error.message);
      throw result.error;
    }
  };

  const subscribeStatementTopic: DeviceSyncTransport['subscribeStatementTopic'] = topic =>
    new Observable(subscriber => {
      // Capture subscribe-time so we can age-filter the historical replay
      // batch. Statement Store delivers every still-alive statement on a
      // matched topic to a new subscriber, regardless of when it was
      // originally submitted. Without filtering, every fresh signaler
      // would re-process stale Offers from previous app sessions and
      // thrash the WebRTC state machine.
      const subscribedAtSecs = Math.floor(Date.now() / 1000);
      const cleanup = statementStoreAdapter.subscribeStatements({ matchAll: [topic] }, ({ statements }) => {
        for (const s of statements) {
          if (!s.data || !s.proof) continue;

          // Age-filter: see submissionSecsFromExpiry for the per-layout
          // derivation. 35s = 30s staleness threshold + ~5s clock-skew
          // tolerance; anything older is dropped silently — the peer's retry
          // layer re-emits a fresh copy if the message still matters.
          if (s.expiry !== undefined) {
            const ageSecs = subscribedAtSecs - submissionSecsFromExpiry(s.expiry);
            if (ageSecs > 35) continue;
          }

          const signerHex = extractSignerHex(s.proof);
          if (!signerHex) continue;
          subscriber.next({ topic, data: s.data, signer: fromHex(signerHex) });
        }
      });
      return () => cleanup();
    });

  return { postStatement, subscribeStatementTopic };
}

type SdkProof = NonNullable<Parameters<typeof statementStoreAdapter.submitStatement>[0]['proof']>;

function extractSignerHex(proof: SdkProof): string | null {
  // The SDK `Proof` enum uses `{ type, value }` discrimination. Every variant
  // carries a 32/33-byte signer hex (or `who` for the onChain variant).
  switch (proof.type) {
    case 'sr25519':
    case 'ed25519':
    case 'ecdsa':
      return proof.value.signer;
    case 'onChain':
      return proof.value.who;
    default:
      return null;
  }
}
