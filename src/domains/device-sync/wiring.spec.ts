import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { type UserIdentity } from '@/domains/device';

import { startDeviceSyncOnIdentity } from './wiring';

// Minimal UserIdentity whose identifying byte fields derive from `seed`, so two
// calls with the same seed produce content-equal (but reference-distinct)
// objects — modelling the hydrate+pair double-emit of the SAME identity.
function makeIdentity(seed: number): UserIdentity {
  const bytes = (tag: number) => new Uint8Array([seed, tag, 0, 0]);

  return {
    identityChatPublicKey: bytes(1),
    identityChatPrivateKey: bytes(2),
    identitySr25519PublicKey: bytes(3),
    rootSr25519PublicKey: bytes(4),
    peerDeviceEncPubKey: bytes(5),
    peerDeviceStatementAccountId: bytes(6),
    ssoEncPubKey: bytes(7),
  };
}

// A controllable `start`: each call returns a deferred so a test can keep a
// start "in flight" while a newer identity arrives, then resolve it. Captures
// the AbortSignal handed to it so a test can assert it was aborted on supersession.
function deferredStart() {
  const stop = vi.fn();
  let signal: AbortSignal | undefined;
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  const start = vi.fn(async (_identity: UserIdentity, abortSignal: AbortSignal) => {
    signal = abortSignal;
    await promise;
    return stop;
  });

  return { start, stop, resolve, getSignal: () => signal };
}

describe('startDeviceSyncOnIdentity', () => {
  it('starts once when the SAME identity is emitted twice (hydrate + pair)', async () => {
    const identity$ = new Subject<UserIdentity | null>();
    const start = vi.fn(async () => vi.fn());

    startDeviceSyncOnIdentity({ identity$, start });

    identity$.next(makeIdentity(1));
    identity$.next(makeIdentity(1)); // distinct object, equal bytes
    await Promise.resolve();

    expect(start).toHaveBeenCalledTimes(1);
  });

  it('aborts an in-flight start the moment a newer identity supersedes it', async () => {
    const identity$ = new Subject<UserIdentity | null>();
    const first = deferredStart();
    const second = deferredStart();
    const start = vi
      .fn<(identity: UserIdentity, signal: AbortSignal) => Promise<() => void>>()
      .mockImplementationOnce(first.start)
      .mockImplementationOnce(second.start);

    startDeviceSyncOnIdentity({ identity$, start });

    identity$.next(makeIdentity(1));
    expect(first.getSignal()?.aborted).toBe(false);

    identity$.next(makeIdentity(2)); // supersedes before first resolves
    expect(start).toHaveBeenCalledTimes(2);

    // The superseded in-flight start is aborted immediately — so a cancellable
    // orchestrator never reaches its spawn/submit, avoiding two live submitters.
    expect(first.getSignal()?.aborted).toBe(true);
    expect(second.getSignal()?.aborted).toBe(false);

    // First resolves AFTER being superseded — its stop is still invoked.
    first.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(first.stop).toHaveBeenCalledTimes(1);

    // Second is the sole live orchestrator.
    second.resolve();
    await Promise.resolve();
    expect(second.stop).not.toHaveBeenCalled();
  });

  it('stops the orchestrator when identity clears to null', async () => {
    const identity$ = new Subject<UserIdentity | null>();
    const { start, stop, resolve } = deferredStart();

    startDeviceSyncOnIdentity({ identity$, start });

    identity$.next(makeIdentity(1));
    resolve();
    await Promise.resolve();
    await Promise.resolve();

    identity$.next(null);
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
