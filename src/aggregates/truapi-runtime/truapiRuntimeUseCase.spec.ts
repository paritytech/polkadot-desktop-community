import { type Bytes32 } from '@parity/truapi';
import { type PermissionAuthorizationStatus, type TrUApiProductProvider } from '@parity/truapi-host';
import { type Mock, afterEach, describe, expect, it, vi } from 'vitest';

import { createStubHostCallbacks } from '@/shared/truapi';
import { sessionUseCase } from '@/domains/application';

import { truapiRuntime } from './state/runtime';
import { truapiRuntimeUseCase } from './truapiRuntimeUseCase';
import { type TruapiHostConfig, type TruapiHostRuntime } from './types';

// `watchSessionTeardown` runs the full logout, which ends in a renderer reload. That one
// method is spied in place so the transition can be observed without reloading the runner.
const performUserLogoutMock = vi.spyOn(sessionUseCase, 'performUserLogout').mockResolvedValue();

const hostConfig: TruapiHostConfig = {
  host: { name: 'Polkadot Desktop', platform: 'Desktop' },
  stack: { pointer: 'polkadotapp://stack?key=0x01&url=https%3A%2F%2Fexample.test', descriptor: new Uint8Array() },
  pairing: { deeplinkScheme: 'polkadot' },
};

function fakeProvider(): TrUApiProductProvider {
  return {
    postMessage: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    dispose: vi.fn(),
    disconnectSession: vi.fn(() => Promise.resolve()),
    getPermissionAuthorizationStatus: vi.fn((): Promise<PermissionAuthorizationStatus> => Promise.resolve('NotDetermined')),
    getPermissionAuthorizationStatuses: vi.fn((): Promise<PermissionAuthorizationStatus[]> => Promise.resolve([])),
    setPermissionAuthorizationStatus: vi.fn(() => Promise.resolve()),
    getSessionChatIdentityKey: vi.fn((): Promise<Bytes32 | undefined> => Promise.resolve(undefined)),
    getDeviceStatementKey: vi.fn((): Promise<Uint8Array | undefined> => Promise.resolve(undefined)),
    getDeviceEncryptionKey: vi.fn((): Promise<Bytes32> => Promise.resolve('0x03')),
    getProductSubtreePublicKey: vi.fn((): Promise<Bytes32 | undefined> => Promise.resolve(undefined)),
  };
}

function fakeRuntime() {
  const runtime: TruapiHostRuntime & { createProvider: Mock; activateStoredSession: Mock } = {
    createProvider: vi.fn(() => Promise.resolve(fakeProvider())),
    disconnectSession: vi.fn(() => Promise.resolve()),
    cancelPairing: vi.fn(),
    clearProductState: vi.fn(() => Promise.resolve()),
    activateStoredSession: vi.fn(() => Promise.resolve()),
    getPermissionAuthorizationStatus: vi.fn((): Promise<PermissionAuthorizationStatus> => Promise.resolve('NotDetermined')),
    getPermissionAuthorizationStatuses: vi.fn((): Promise<PermissionAuthorizationStatus[]> => Promise.resolve([])),
    setPermissionAuthorizationStatus: vi.fn(() => Promise.resolve()),
    getProductSubtreePublicKey: vi.fn((): Promise<Uint8Array | undefined> => Promise.resolve(undefined)),
    acquireWorker: vi.fn(),
    releaseWorker: vi.fn(),
    subscribeWorkerDemand: vi.fn(() => () => {}),
    dispose: vi.fn(),
  };

  return runtime;
}

function callbacks() {
  return { ...createStubHostCallbacks(), auth: { authStateChanged: vi.fn() } };
}

afterEach(() => {
  truapiRuntimeUseCase.dispose();
});

describe('truapiRuntimeUseCase', () => {
  // Two runtimes mean two core sessions and duplicate ghost sessions on the bulletin
  // chain — the hazard `application/papp-provider/provider.ts` documents. The guard
  // has to be the in-flight promise, not the resolved value.
  it('creates exactly one runtime across concurrent starts', async () => {
    const create = vi.fn(() => Promise.resolve(fakeRuntime()));

    await Promise.all([
      truapiRuntimeUseCase.start(callbacks(), hostConfig, { create }),
      truapiRuntimeUseCase.start(callbacks(), hostConfig, { create }),
    ]);

    expect(create).toHaveBeenCalledOnce();
  });

  // A product surface mounts before `start` runs — `start` waits for the active
  // environment, the surface does not. The call must queue, not error.
  it('holds createProvider called before start until the runtime is up', async () => {
    const runtime = fakeRuntime();
    const opened = truapiRuntimeUseCase.createProvider({ productId: 'demo.dot', executionKind: 'App' });

    await truapiRuntimeUseCase.start(callbacks(), hostConfig, { create: () => Promise.resolve(runtime) });

    await expect(opened).resolves.toBeDefined();
    expect(runtime.createProvider).toHaveBeenCalledWith({ productId: 'demo.dot', executionKind: 'App' });
  });

  // The core's `activateStoredSession` resolves "once product frames may use it". A
  // product wire opened before that reaches a core with no session yet, and every
  // session-bound call it makes fails with `No active session`.
  it('holds createProvider until the stored session is activated', async () => {
    let activate!: VoidFunction;
    const runtime = fakeRuntime();
    runtime.activateStoredSession.mockImplementation(() => new Promise<void>(resolve => (activate = resolve)));
    const started = truapiRuntimeUseCase.start(callbacks(), hostConfig, { create: () => Promise.resolve(runtime) });
    await vi.waitFor(() => expect(runtime.activateStoredSession).toHaveBeenCalled());

    const opened = truapiRuntimeUseCase.createProvider({ productId: 'demo.dot', executionKind: 'App' });
    await Promise.resolve();
    expect(runtime.createProvider).not.toHaveBeenCalled();

    activate();
    await started;
    await expect(opened).resolves.toBeDefined();
    expect(runtime.createProvider).toHaveBeenCalledWith({ productId: 'demo.dot', executionKind: 'App' });
  });

  // A boot with nothing to restore is a signed-out boot, not a broken one: products
  // still open, against a core that answers them as signed out.
  it('opens a held createProvider when there is no stored session to activate', async () => {
    const runtime = fakeRuntime();
    runtime.activateStoredSession.mockImplementation(() => Promise.reject(new Error('no session')));
    const opened = truapiRuntimeUseCase.createProvider({ productId: 'demo.dot' });

    await truapiRuntimeUseCase.start(callbacks(), hostConfig, { create: () => Promise.resolve(runtime) });

    await expect(opened).resolves.toBeDefined();
  });

  it('rejects a queued createProvider when the runtime fails to start', async () => {
    const opened = truapiRuntimeUseCase.createProvider({ productId: 'demo.dot' });

    await expect(
      truapiRuntimeUseCase.start(callbacks(), hostConfig, { create: () => Promise.reject(new Error('boom')) }),
    ).rejects.toThrow('boom');

    await expect(opened).rejects.toThrow('boom');
  });

  it('opens a provider for a product once started', async () => {
    const runtime = fakeRuntime();
    await truapiRuntimeUseCase.start(callbacks(), hostConfig, { create: () => Promise.resolve(runtime) });

    await truapiRuntimeUseCase.createProvider({ productId: 'demo.dot', executionKind: 'App' });

    expect(runtime.createProvider).toHaveBeenCalledWith({ productId: 'demo.dot', executionKind: 'App' });
  });

  it('clears the runtime on dispose', async () => {
    const runtime = fakeRuntime();
    await truapiRuntimeUseCase.start(callbacks(), hostConfig, { create: () => Promise.resolve(runtime) });

    truapiRuntimeUseCase.dispose();

    expect(runtime.dispose).toHaveBeenCalledOnce();
    expect(truapiRuntime.get().runtime).toBeNull();
  });

  it('publishes auth state transitions from the core', async () => {
    const hostCallbacks = callbacks();
    await truapiRuntimeUseCase.start(hostCallbacks, hostConfig, { create: () => Promise.resolve(fakeRuntime()) });

    truapiRuntimeUseCase.publishAuthState({ tag: 'Connected', value: { publicKey: `0x${'00'.repeat(32)}` } });

    expect(truapiRuntime.get().authState).toMatchObject({ tag: 'Connected' });
  });

  // The core emits only on a *change*, so a signed-out boot produces no emission at
  // all. Without this the route loaders wait on `whenAuthResolved()` forever and the
  // app never leaves the index route.
  it('settles auth as Disconnected when the core emits nothing on boot', async () => {
    await truapiRuntimeUseCase.start(callbacks(), hostConfig, { create: () => Promise.resolve(fakeRuntime()) });

    await expect(truapiRuntimeUseCase.whenAuthResolved()).resolves.toMatchObject({ tag: 'Disconnected' });
  });

  // ...but a state the core did emit during startup must win over that fallback.
  it('keeps a core emission that arrives during start', async () => {
    const hostCallbacks = callbacks();
    await truapiRuntimeUseCase.start(hostCallbacks, hostConfig, {
      create: () => {
        truapiRuntimeUseCase.publishAuthState({ tag: 'Authenticating' });

        return Promise.resolve(fakeRuntime());
      },
    });

    expect(truapiRuntime.get().authState).toMatchObject({ tag: 'Authenticating' });
  });

  // The whole point of awaiting activation: a paired user's session arrives during it,
  // so the Disconnected fallback must not have run first and bounced them to onboarding.
  it('keeps the session a stored-session activation restores', async () => {
    const runtime = fakeRuntime();
    runtime.activateStoredSession.mockImplementation(() => {
      truapiRuntimeUseCase.publishAuthState({ tag: 'Authenticating' });

      return Promise.resolve();
    });

    await truapiRuntimeUseCase.start(callbacks(), hostConfig, { create: () => Promise.resolve(runtime) });

    expect(runtime.activateStoredSession).toHaveBeenCalled();
    expect(truapiRuntime.get().authState).toMatchObject({ tag: 'Authenticating' });
  });

  // A runtime that cannot restore anything is a signed-out boot, not a broken one —
  // the loaders must still settle rather than wait on a promise that never resolves.
  it('settles auth as Disconnected when the stored-session activation rejects', async () => {
    const runtime = fakeRuntime();
    runtime.activateStoredSession.mockRejectedValue(new Error('runtime disposed'));

    await truapiRuntimeUseCase.start(callbacks(), hostConfig, { create: () => Promise.resolve(runtime) });

    await expect(truapiRuntimeUseCase.whenAuthResolved()).resolves.toMatchObject({ tag: 'Disconnected' });
  });

  it('resolves whenAuthResolved immediately once auth is already known', async () => {
    await truapiRuntimeUseCase.start(callbacks(), hostConfig, { create: () => Promise.resolve(fakeRuntime()) });
    truapiRuntimeUseCase.publishAuthState({ tag: 'Disconnected' });

    await expect(truapiRuntimeUseCase.whenAuthResolved()).resolves.toMatchObject({ tag: 'Disconnected' });
  });

  // Kept last: `watchSessionTeardown` subscribes for the process lifetime with no
  // unsubscribe, so a second one would double-fire against later tests. One test drives
  // the whole state machine to keep exactly one subscription alive.
  it('raises the logout splash and runs the full logout only after a session was connected', () => {
    truapiRuntimeUseCase.watchSessionTeardown();

    // A cold `Disconnected` (never connected) is a signed-out boot, not a logout.
    truapiRuntimeUseCase.publishAuthState({ tag: 'Disconnected' });
    expect(truapiRuntime.get().loggingOut).toBe(false);
    expect(performUserLogoutMock).not.toHaveBeenCalled();

    // Connect, then drop — that is a real logout: splash up, teardown running.
    truapiRuntimeUseCase.publishAuthState({ tag: 'Connected', value: { publicKey: `0x${'00'.repeat(32)}` } });
    truapiRuntimeUseCase.publishAuthState({ tag: 'Disconnected' });

    expect(truapiRuntime.get().loggingOut).toBe(true);
    expect(performUserLogoutMock).toHaveBeenCalledTimes(1);
  });
});
