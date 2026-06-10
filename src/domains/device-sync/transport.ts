/**
 * Adapter mapping orchestrator's `postStatement` / `subscribeStatementTopic`
 * ports onto `statementStoreAdapter`. Statements are signed by the device's
 * sr25519 (key whose pubkey is `statementAccountId`); a single 32-byte
 * khash-derived pair topic per direction, `matchAll: [topic]` on subscribe.
 */

import { createExpiry } from '@novasamatech/sdk-statement';
import { AccountFullError, ExpiryTooLowError, createSr25519Prover } from '@novasamatech/statement-store';
import { fromHex, toHex } from 'polkadot-api/utils';
import { Observable } from 'rxjs';

import { takeExpirySequenceNumber } from '@/shared/utils';
import { statementStoreAdapter } from '@/domains/application';

// Match the chat send path. Signaling is short-lived (offer/answer/candidates
// flushed within seconds) but cheap to keep — using a long expiry survives
// transient chain latency without forcing the caller to re-emit.
const EXPIRY_DURATION_SECS = 7 * 24 * 60 * 60;

// AccountFull / ExpiryTooLow can clear themselves once existing statements
// roll off the account's slot window — a short backoff is usually enough.
// We retry transparently so a single failure on a multi-fragment send (like
// trickling ICE candidates) doesn't strand the signaler.
const RETRY_DELAYS_MS = [500, 1500, 3000];

// Sequence number for the low 32 bits of expiry comes from
// `takeExpirySequenceNumber` (a process-wide counter in `@/shared/utils`).
// Device-sync and chat submit with the *same* device key, so a per-module
// counter would collide across them within the same second; the shared
// counter keeps every submit's expiry unique regardless of which subsystem
// queued it.

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

function isTransientSubmitError(err: unknown): boolean {
  return err instanceof AccountFullError || err instanceof ExpiryTooLowError;
}

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

export function createDeviceSyncTransport(deviceStatementAccountSeed: Uint8Array): DeviceSyncTransport {
  const prover = createSr25519Prover(deviceStatementAccountSeed);

  const postStatement = async (topic: Uint8Array, data: Uint8Array, channel: Uint8Array): Promise<void> => {
    let attempt = 0;
    while (true) {
      // Re-sign on every attempt: the expiry value is wall-clock-derived,
      // and re-signing with a fresh expiry is the only way to recover from
      // ExpiryTooLow on retry. Each retry also takes a fresh sequence
      // number, so a same-second retry doesn't repeat the previous bit-
      // identical expiry that the chain just rejected.
      const expirationTimestampSecs = Math.floor(Date.now() / 1000) + EXPIRY_DURATION_SECS;
      const expiry = createExpiry(expirationTimestampSecs, takeExpirySequenceNumber());
      const unsigned = { expiry, channel: toHex(channel), topics: [toHex(topic)], data };
      const signed = await prover.generateMessageProof(unsigned);
      if (signed.isErr()) {
        console.error('WEBRTC [transport] sign failed for topic=%s: %s', toHex(topic), signed.error.message);
        throw signed.error;
      }

      const submitted = await statementStoreAdapter.submitStatement(signed.value);
      if (submitted.isOk()) return;

      const err = submitted.error;
      if (isTransientSubmitError(err) && attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt]!;
        console.warn(
          'WEBRTC [transport] submit transient failure for topic=%s attempt=%d will retry in %dms: %s',
          toHex(topic),
          attempt,
          delay,
          err.message,
        );
        attempt += 1;
        await sleep(delay);
        continue;
      }

      console.error('WEBRTC [transport] submit failed for topic=%s: %s', toHex(topic), err.message);
      throw err;
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

          // Age-filter: derive submission time from the statement's expiry
          // and our well-known posting duration (`EXPIRY_DURATION_SECS`).
          // `expiry = (submissionSecs + durationSecs) << 32 | sequence` (see
          // sdk-statement `createExpiry`). If both sides post with the same
          // 7-day duration, a statement older than 30s before our subscribe
          // shows up here with `submission < subscribedAt - 30`.
          //
          // We tolerate up to a ~5-second clock skew between us and the
          // posting peer by relaxing the threshold to 35s. Anything older
          // is dropped silently — the peer's retry layer will re-emit a
          // fresh copy if the message still matters.
          if (s.expiry !== undefined) {
            const expirySecs = Number(s.expiry >> 32n);
            const submissionSecs = expirySecs - EXPIRY_DURATION_SECS;
            const ageSecs = subscribedAtSecs - submissionSecs;
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
