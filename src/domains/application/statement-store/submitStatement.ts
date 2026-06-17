/**
 * App-policy wrapper over the library's sign-and-submit primitive.
 *
 * Policy: priority errors (AccountFull / ExpiryTooLow) get 3 escalating
 * retries — each re-signed above the chain-reported minimum via the call's
 * `allocator` — then propagate; any other error propagates immediately (the
 * callers' own layers — chat outbox, device-sync orchestrator — own terminal
 * handling). Throws on failure (Promise contract kept from the previous
 * per-domain helpers).
 */

import {
  type ExpiryAllocator,
  type StatementProver,
  type StatementStoreAdapter,
  createExpiryAllocator,
  createSr25519Prover,
  signAndSubmitStatement as submitWithLibraryRetry,
} from '@novasamatech/statement-store';
import { toHex } from 'polkadot-api/utils';

const RETRY_DELAYS_MS = [500, 1500, 3000];

// float64 step for expiries in [2^63, 2^64) — every pinned-high expiry rounds to a multiple of this over the JSON-RPC wire.
const EXPIRY_FLOAT_STEP = 2048n;

export type StatementSubmitParams = {
  /** Pass either a ready prover (e.g. when many submits share one) or a raw sr25519 seed. */
  prover?: StatementProver;
  signerSeed?: Uint8Array;
  statementStore: StatementStoreAdapter;
  channel: Uint8Array;
  /** One or more topics to attach to the statement. */
  topics: Uint8Array | Uint8Array[];
  data: Uint8Array;
  /**
   * Expiry source for this submit (and its priority-retries). Inject ONE
   * allocator shared by every writer that signs with the SAME account so
   * same-second submits cannot tie on priority; those callers also seed its
   * floor once at session init. Defaults to a fresh private allocator whose
   * floor is seeded here from the topic before submitting, so a one-shot submit
   * can't tie with our own statement surviving on this channel from a previous
   * session.
   */
  allocator?: ExpiryAllocator;
  /** Tag prepended to retry warn logs so each call site is identifiable. */
  logTag: string;
};

export async function signAndSubmitStatement(params: StatementSubmitParams): Promise<void> {
  const { prover: providedProver, signerSeed, statementStore, channel, topics, data, logTag } = params;
  if (!providedProver && !signerSeed) {
    throw new Error('signAndSubmitStatement: either prover or signerSeed is required');
  }
  const prover = providedProver ?? createSr25519Prover(signerSeed!);
  const topicArray = Array.isArray(topics) ? topics : [topics];
  const logTopic = topicArray[0] ? toHex(topicArray[0]) : '';

  // Expiry synchronization (the session spec's init step). Callers that submit
  // repeatedly inject ONE shared allocator and seed its floor themselves once at
  // session init. A one-shot submit instead gets a fresh allocator (floor 0),
  // which can tie with a statement we left on this (account, channel) in a
  // previous app session — so seed the fresh allocator's floor from the topic
  // first, so it signs above the surviving statement and clears immediately.
  // min_expiry comes back as a JSON number that polkadot-api rounds into a float64,
  // landing up to one step below the true minimum; bump the adopted floor a full step
  // so a retry clears it instead of crawling +1 underneath. Wrapping raiseFloor is the
  // seam — the library overrides our onPriorityError with its own allocator.raiseFloor.
  const base = params.allocator ?? createExpiryAllocator();
  const allocator: ExpiryAllocator = {
    next: () => base.next(),
    raiseFloor: min => base.raiseFloor(BigInt(min) + EXPIRY_FLOAT_STEP),
  };
  if (!params.allocator) {
    await seedExpiryFloorFromTopics(allocator, statementStore, topicArray, logTag);
  }

  const result = await submitWithLibraryRetry({
    statementStore,
    prover,
    allocator,
    channel,
    topics: topicArray,
    data,
    retry: {
      attempts: 0, // non-priority errors propagate immediately
      priorityAttempts: RETRY_DELAYS_MS.length,
      delaysMs: RETRY_DELAYS_MS,
      onPriorityError(error) {
        allocator.raiseFloor(error.min);
      },
      onRetry({ attempt, delayMs, error }) {
        console.warn(
          '[%s] submit transient failure topic=%s attempt=%d will retry in %dms: %s',
          logTag,
          logTopic,
          attempt,
          delayMs,
          error.message,
        );
      },
    },
  });
  if (result.isErr()) throw result.error;
}

/**
 * Raise `allocator`'s floor to the highest expiry already live on `topics`, so
 * the next mint signs strictly above our own surviving statements there. Reads
 * only the plaintext `.expiry` wire field. A failed query is non-fatal — the
 * submit proceeds and falls back to priority-rejection retries.
 */
async function seedExpiryFloorFromTopics(
  allocator: ExpiryAllocator,
  statementStore: StatementStoreAdapter,
  topics: Uint8Array[],
  logTag: string,
): Promise<void> {
  // Best-effort: the seed is an optimization, so a failed (or unavailable)
  // query must never block the submit — fall back to priority-rejection retries.
  try {
    const result = await statementStore.queryStatements({ matchAll: topics });
    if (result.isErr()) {
      console.warn('[%s] expiry-floor sync failed: %s', logTag, result.error.message);
      return;
    }
    let maxExpiry = 0n;
    for (const s of result.value) {
      if (s.expiry !== undefined && s.expiry > maxExpiry) maxExpiry = s.expiry;
    }
    allocator.raiseFloor(maxExpiry);
  } catch (e) {
    console.warn('[%s] expiry-floor sync threw: %s', logTag, e instanceof Error ? e.message : String(e));
  }
}
