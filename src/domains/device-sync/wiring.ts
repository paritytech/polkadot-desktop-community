/**
 * Device-sync host wiring.
 *
 * `startDeviceSyncIfReady` is the one-shot start (feature flag + identity check
 * → orchestrator, or a no-op stop). `startDeviceSyncOnIdentity` drives it
 * reactively from `userIdentity$`, sequencing start/stop so a fresh SSO V2
 * handshake mid-session respawns the orchestrator without an app relaunch — and
 * overlapping emissions never leave two orchestrators racing.
 */

import { toHex } from '@novasamatech/scale';
import { type Subscription, EMPTY, Observable, distinctUntilChanged, switchMap } from 'rxjs';

import { FEATURE_FLAGS } from '@/shared/featureFlags';
import { type DeviceIdentity, type UserIdentity } from '@/domains/device';

import { type DeviceSyncOrchestratorParams, startDeviceSyncOrchestrator } from './orchestrator';

export type DeviceSyncWiringDeps = {
  device: DeviceIdentity | null;
  userIdentity: UserIdentity | null;
  fetchInitialPeers: DeviceSyncOrchestratorParams['fetchInitialPeers'];
  subscribeStatementTopic: DeviceSyncOrchestratorParams['subscribeStatementTopic'];
  postStatement: DeviceSyncOrchestratorParams['postStatement'];
  resolveConsumerInfo: DeviceSyncOrchestratorParams['resolveConsumerInfo'];
  ownUserId: DeviceSyncOrchestratorParams['ownUserId'];
  iceConfig: DeviceSyncOrchestratorParams['iceConfig'];
  /** Aborts a superseded start before it spawns; see {@link startDeviceSyncOnIdentity}. */
  signal?: AbortSignal;
};

export async function startDeviceSyncIfReady(deps: DeviceSyncWiringDeps): Promise<VoidFunction> {
  if (!FEATURE_FLAGS.deviceSync) {
    return () => {};
  }
  if (!deps.device || !deps.userIdentity) {
    return () => {};
  }

  const handle = await startDeviceSyncOrchestrator({
    ownDevice: {
      statementAccountId: deps.device.statementAccountPublicKey,
      encryptionPrivateKey: deps.device.encryptionPrivateKey,
      encryptionPublicKey: deps.device.encryptionPublicKey,
    },
    fetchInitialPeers: deps.fetchInitialPeers,
    subscribeStatementTopic: deps.subscribeStatementTopic,
    postStatement: deps.postStatement,
    resolveConsumerInfo: deps.resolveConsumerInfo,
    ownUserId: deps.ownUserId,
    iceConfig: deps.iceConfig,
    signal: deps.signal,
  });

  return handle.stop;
}

/**
 * Starts the orchestrator for `identity`; resolves to its stop fn. `signal`
 * aborts when a newer identity supersedes this start — the start MUST honour it
 * (bail before spawning) so a superseded run never submits.
 */
export type DeviceSyncIdentityStart = (identity: UserIdentity, signal: AbortSignal) => Promise<VoidFunction>;

/**
 * Reactive device-sync lifecycle: (re)starts the orchestrator as the user
 * identity settles, always tearing the previous run down first.
 *
 * The bare `userIdentity$` subscription this replaces assigned its "stop
 * previous" handle only AFTER the async start resolved (which awaits
 * `fetchInitialPeers` + staggered spawns), so an emission arriving mid-start
 * left the in-flight orchestrator running and spawned a second one. Two
 * orchestrators mean two `createDeviceSyncTransport` expiry allocators minting
 * identical second-resolution expiries for the same `(account, channel)`, which
 * the statement store rejects as `ExpiryTooLow`/`AccountFull` — a retry/respawn
 * storm.
 *
 * `switchMap` disposes the previous inner subscription before subscribing the
 * next; `runDeviceSync$` then aborts that start's `AbortSignal` so an in-flight
 * orchestrator stops BEFORE it spawns/submits (a torn-down Observable cannot
 * unwind an already-running async start otherwise), and still stops the handle
 * if the start had already resolved — so at most one orchestrator is ever live.
 * `distinctUntilChanged(sameUserIdentity)` collapses the hydrate+pair double-emit
 * of the SAME identity into a single start.
 */
export function startDeviceSyncOnIdentity(params: {
  identity$: Observable<UserIdentity | null>;
  start: DeviceSyncIdentityStart;
}): Subscription {
  return params.identity$
    .pipe(
      distinctUntilChanged(sameUserIdentity),
      switchMap(identity => {
        if (!identity) return EMPTY;
        console.info('WEBRTC [device-sync] identity settled — (re)starting orchestrator');
        return runDeviceSync$(signal => params.start(identity, signal));
      }),
    )
    .subscribe();
}

/**
 * Wraps an async start in an Observable whose teardown both aborts the start's
 * signal (so a not-yet-spawned orchestrator bails) and stops the handle if the
 * start had already resolved.
 */
function runDeviceSync$(start: (signal: AbortSignal) => Promise<VoidFunction>): Observable<never> {
  return new Observable<never>(() => {
    const controller = new AbortController();
    let stop: VoidFunction | null = null;

    start(controller.signal)
      .then(s => {
        if (controller.signal.aborted) s();
        else stop = s;
      })
      .catch((error: unknown) => {
        console.error('Failed to start device-sync orchestrator:', error);
      });

    return () => {
      controller.abort();
      stop?.();
      stop = null;
    };
  });
}

/** Equal device-sync inputs: the identifying key material the orchestrator seeds from. */
function sameUserIdentity(a: UserIdentity | null, b: UserIdentity | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  return (
    toHex(a.identitySr25519PublicKey) === toHex(b.identitySr25519PublicKey) &&
    toHex(a.peerDeviceStatementAccountId) === toHex(b.peerDeviceStatementAccountId) &&
    toHex(a.peerDeviceEncPubKey) === toHex(b.peerDeviceEncPubKey)
  );
}
