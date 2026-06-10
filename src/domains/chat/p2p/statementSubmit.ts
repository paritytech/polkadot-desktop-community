/**
 * Sign-and-submit a chat statement with monotonic-sequence expiry and retry
 * on transient submit errors.
 *
 * `createExpiry` packs the expiration timestamp (seconds since epoch) into the
 * high 32 bits and a sequence number into the low 32 bits. Callers that use
 * the default `sequenceNumber = 0` produce bit-identical 64-bit expiries for
 * any two posts within the same wall-clock second. The Bulletin chain
 * statement-store rejects ties with `accountFull: submitted_expiry ==
 * min_expiry` — to evict an existing slot the new priority must be strictly
 * greater than the current minimum. A debounced outbox or a UI that lets the
 * user hit send twice in under a second hits this immediately.
 *
 * The fix has two parts:
 *
 *  1. Bump a per-process counter into the low 32 bits so every submit gets a
 *     unique expiry within the same second. The high 32 bits still dominate
 *     ordering across seconds, so age-filtering on receive (`expiry >> 32`)
 *     is unaffected.
 *  2. Retry on `AccountFullError` / `ExpiryTooLowError` with a fresh expiry
 *     (and fresh sequence) — these can also fire when an unrelated submission
 *     just landed and raised the chain's min-expiry watermark above ours.
 *
 * The `domains/device-sync/transport.ts` adapter implements the same defense
 * in-line; this helper is the chat-p2p equivalent, shared across every chat
 * statement-store submit site (chat requests V1/V2, outbox, session V2,
 * identity-channel accept signal).
 */

import { createExpiry } from '@novasamatech/sdk-statement';
import {
  type Statement,
  type StatementProver,
  type StatementStoreAdapter,
  AccountFullError,
  ExpiryTooLowError,
  createSr25519Prover,
} from '@novasamatech/statement-store';
import { toHex } from 'polkadot-api/utils';

import { takeExpirySequenceNumber } from '@/shared/utils';

const EXPIRY_DURATION_SECS = 7 * 24 * 60 * 60;
const RETRY_DELAYS_MS = [500, 1500, 3000];

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const isTransientSubmitError = (err: unknown): boolean => err instanceof AccountFullError || err instanceof ExpiryTooLowError;

export type StatementSubmitParams = {
  /** Pass either a ready prover (e.g. when many submits share one) or a raw sr25519 seed. */
  prover?: StatementProver;
  signerSeed?: Uint8Array;
  statementStore: StatementStoreAdapter;
  channel: Uint8Array;
  /** One or more topics to attach to the statement. */
  topics: Uint8Array | Uint8Array[];
  data: Uint8Array;
  /** Tag prepended to retry warn logs so each call site is identifiable. */
  logTag: string;
};

export const signAndSubmitStatement = async (params: StatementSubmitParams): Promise<void> => {
  const { prover: providedProver, signerSeed, statementStore, channel, topics, data, logTag } = params;
  if (!providedProver && !signerSeed) {
    throw new Error('signAndSubmitStatement: either prover or signerSeed is required');
  }
  const prover = providedProver ?? createSr25519Prover(signerSeed!);
  const topicArray = Array.isArray(topics) ? topics : [topics];
  const topicsHex = topicArray.map(t => toHex(t));
  const logTopic = topicsHex[0] ?? '';
  let attempt = 0;
  while (true) {
    // Re-sign on every attempt: the expiry is wall-clock-derived and a fresh
    // expiry+sequence is the only way to clear ExpiryTooLow on retry.
    const expirationTimestampSecs = Math.floor(Date.now() / 1000) + EXPIRY_DURATION_SECS;
    const expiry = createExpiry(expirationTimestampSecs, takeExpirySequenceNumber());
    const unsigned = {
      expiry,
      channel: toHex(channel),
      topics: topicsHex,
      data,
    } satisfies Omit<Statement, 'proof'>;

    const signResult = await prover.generateMessageProof(unsigned);
    if (signResult.isErr()) throw signResult.error;

    const submitResult = await statementStore.submitStatement(signResult.value);
    if (submitResult.isOk()) return;

    const err = submitResult.error;
    if (isTransientSubmitError(err) && attempt < RETRY_DELAYS_MS.length) {
      const delay = RETRY_DELAYS_MS[attempt]!;
      console.warn(
        '[%s] submit transient failure topic=%s attempt=%d will retry in %dms: %s',
        logTag,
        logTopic,
        attempt,
        delay,
        err.message,
      );
      attempt += 1;
      await sleep(delay);
      continue;
    }
    throw err;
  }
};
