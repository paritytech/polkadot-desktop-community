import { asProductId } from '@parity/truapi';
import { type AuthState, type ExecutableKind, type RequiredHostCallbacks, type TrUApiProductProvider } from '@parity/truapi-host';
import * as v from 'valibot';

import { promiseWithResolvers } from '@/shared/utils';
import { HOST_AUTH_PRODUCT_ID, sessionUseCase } from '@/domains/application';
import { accountId } from '@/domains/network';

import { markLoggingOut, setAuthState, truapiRuntime } from './state/runtime';
import { type CreateRuntime, type TruapiHostConfig, type TruapiHostRuntime } from './types';

// Guarding on the in-flight promise rather than the resolved runtime: two callers
// arriving in the same tick would both see `runtime === null` and boot two cores,
// which means two core sessions and duplicate ghost sessions on the bulletin chain.
let starting: Promise<TruapiHostRuntime> | null = null;
let authResolved: ReturnType<typeof promiseWithResolvers<AuthState>> | null = null;
// Created only when someone actually waits, so a start failure never rejects a
// promise nobody is holding.
let runtimeReady: ReturnType<typeof promiseWithResolvers<TruapiHostRuntime>> | null = null;
let activatedRuntime: TruapiHostRuntime | null = null;
let sessionActivated: ReturnType<typeof promiseWithResolvers<TruapiHostRuntime>> | null = null;
// One reused provider for host-initiated auth: each provider is a fresh core
// session, so a new one per attempt would strand the previous pairing.
let hostAuthProvider: Promise<TrUApiProductProvider> | null = null;

async function defaultCreate(callbacks: RequiredHostCallbacks, config: TruapiHostConfig): Promise<TruapiHostRuntime> {
  const [{ createWebWorkerPairingHostRuntime }, { default: HostWorker }] = await Promise.all([
    import('@parity/truapi-host/web'),
    import('@parity/truapi-host/worker-runtime?worker'),
  ]);

  return createWebWorkerPairingHostRuntime(new HostWorker(), callbacks, { hostConfig: config });
}

/**
 * Boot the core. Idempotent — concurrent and repeated calls share one runtime.
 *
 * MUST NOT be called at module-import time: the People and Bulletin genesis hashes
 * come from the active environment, which resolves asynchronously.
 */
async function start(
  callbacks: RequiredHostCallbacks,
  config: TruapiHostConfig,
  options?: { create?: CreateRuntime },
): Promise<void> {
  if (starting) {
    await starting;

    return;
  }

  const create = options?.create ?? defaultCreate;
  authResolved ??= promiseWithResolvers<AuthState>();

  starting = create(callbacks, config);

  try {
    const runtime = await starting;
    truapiRuntime.set(prev => ({ ...prev, runtime }));
    runtimeReady?.resolve(runtime);
    runtimeReady = null;

    // Restore a persisted session before anyone reads the auth state. The core's
    // `activateStoredSession` "resolves once product frames may use it, so a host can
    // await this at boot before routing" — which is exactly what the route loaders do
    // through `whenAuthResolved`. Awaiting it is what makes the silence below
    // meaningful: a paired user's `Connected` has arrived by the time we look.
    //
    // Best-effort by design. It rejects on a disposed or faulted runtime, and a boot
    // that cannot restore a session is a signed-out boot, not a broken one — falling
    // through to `Disconnected` sends the user to onboarding instead of stranding
    // every route loader on a promise that never settles.
    await runtime.activateStoredSession().catch((error: unknown) => {
      console.warn('[truapi] no stored session was activated; treating this boot as signed out', error);
    });

    // `authStateChanged` fires only on a *change*, so a core with nothing to restore
    // stays silent forever and a host that waits for a first emission waits for good.
    // Silence *after* activation therefore means signed out.
    if (truapiRuntime.get().authState === null) {
      publishAuthState({ tag: 'Disconnected' });
    }

    activatedRuntime = runtime;
    sessionActivated?.resolve(runtime);
    sessionActivated = null;
  } catch (error) {
    starting = null;
    runtimeReady?.reject(error);
    runtimeReady = null;
    sessionActivated?.reject(error);
    sessionActivated = null;
    throw error;
  }
}

/**
 * Resolves once the core is booted; rejects if the boot fails.
 *
 * A product surface mounts on its own schedule and `start` waits for the active
 * environment, so callers routinely arrive first. Waiting here is what makes the
 * order irrelevant — reading the runtime directly turns "not yet" into an error.
 */
function whenRuntimeReady(): Promise<TruapiHostRuntime> {
  const current = truapiRuntime.get().runtime;
  if (current) return Promise.resolve(current);

  runtimeReady ??= promiseWithResolvers<TruapiHostRuntime>();

  return runtimeReady.promise;
}

/**
 * Resolves once the core has finished restoring the stored session (or found none).
 *
 * The core's `activateStoredSession` "resolves once product frames may use it". A
 * product wire opened while the runtime exists but activation is still running reaches
 * a core with no session, and every session-bound call it makes fails `No active
 * session` — for a user who is signed in.
 */
function whenSessionActivated(): Promise<TruapiHostRuntime> {
  if (activatedRuntime) return Promise.resolve(activatedRuntime);

  sessionActivated ??= promiseWithResolvers<TruapiHostRuntime>();

  return sessionActivated.promise;
}

/** Open a wire to one product, once the core is up and its stored session is restored. */
async function createProvider({
  productId,
  executionKind,
}: {
  productId: string;
  executionKind?: ExecutableKind;
}): Promise<TrUApiProductProvider> {
  const runtime = await whenSessionActivated();
  return runtime.createProvider({ productId: asProductId(productId), executionKind });
}

/**
 * Declare that something on screen needs a product's worker running.
 *
 * Deferred like `createProvider`: a surface mounts on its own schedule and the core
 * boots asynchronously, so an early caller waits rather than failing. Pair every
 * acquire with one release.
 */
async function acquireWorker(productId: string): Promise<void> {
  const runtime = await whenRuntimeReady();
  runtime.acquireWorker(asProductId(productId));
}

/** Drop one `acquireWorker` reference. Releasing with none held is a no-op. */
async function releaseWorker(productId: string): Promise<void> {
  const runtime = await whenRuntimeReady();
  runtime.releaseWorker(asProductId(productId));
}

/**
 * The account id a core auth state identifies, or `null` when it is not connected.
 *
 * `identityAccountId` is the wallet identity the app keys per-user data by. It is
 * optional on the core's session info, and `publicKey` is a different key — falling
 * back changes every derived key, so the substitution is logged rather than silent.
 */
function toUserId(authState: Nullable<AuthState>) {
  if (authState?.tag !== 'Connected') return null;

  const { identityAccountId, publicKey } = authState.value;
  if (!identityAccountId) {
    console.warn('[truapi] session has no identityAccountId; keying user data by publicKey instead');
  }

  return v.parse(accountId, identityAccountId ?? publicKey);
}

/** Record a core auth transition and release anyone waiting on the first one. */
function publishAuthState(state: AuthState): void {
  console.debug('[truapi] auth state', state.tag);
  setAuthState(state);
  authResolved?.resolve(state);
}

/**
 * Resolves once the core has reported auth at least once.
 *
 * For non-React callers that must not guess — route loaders in particular, which
 * cannot call hooks and would otherwise read `Disconnected` before the worker has
 * answered, sending a paired user through onboarding on every cold start.
 */
function whenAuthResolved(): Promise<AuthState> {
  const current = truapiRuntime.get().authState;
  if (current) return Promise.resolve(current);

  authResolved ??= promiseWithResolvers<AuthState>();

  return authResolved.promise;
}

/**
 * Single local-teardown path: run the full user logout when a session that was
 * established goes away.
 *
 * Every way out of an authenticated session ends in the core reporting
 * `Disconnected` — the Log Out button, a network switch, or the wallet dropping
 * the pairing from its side.
 *
 * The `sawConnected` latch is load-bearing twice over. `authState` is `null`
 * before the core's first emission and `Disconnected` for a user who has never
 * paired, so without it every cold start would wipe the profile. And
 * `performUserLogout` ends in a renderer reload, so a second emission arriving
 * before that commits must not start a concurrent teardown.
 */
function watchSessionTeardown(): void {
  let sawConnected = truapiRuntime.get().authState?.tag === 'Connected';
  let tearingDown = false;

  truapiRuntime.value$.subscribe(({ authState }) => {
    if (authState?.tag === 'Connected') {
      sawConnected = true;

      return;
    }

    if (authState?.tag !== 'Disconnected' || !sawConnected || tearingDown) return;

    tearingDown = true;
    // Raise the splash before the async teardown runs, so the authenticated shell
    // never repaints signed-out and the onboarding redirect never flashes.
    markLoggingOut();
    console.info('[sso] core session disconnected while authenticated — running full user logout');
    void sessionUseCase.performUserLogout();
  });
}

/** The host's own provider, created once and reused for every auth interaction. */
function getHostAuthProvider(): Promise<TrUApiProductProvider> {
  hostAuthProvider ??= createProvider({ productId: HOST_AUTH_PRODUCT_ID, executionKind: 'App' });

  return hostAuthProvider;
}

/**
 * The active session's X25519 chat identity secret, or `undefined` when no session
 * is connected.
 *
 * Deliberately absent from `SessionUiInfo`: that projection rides every `AuthState`
 * broadcast, so the core keeps the secret behind an explicit read instead. Only the
 * P2P chat channel needs it.
 */
async function getChatIdentityKey(): Promise<string | undefined> {
  const provider = await getHostAuthProvider();

  return provider.getSessionChatIdentityKey();
}

/**
 * Start a pairing. The deeplink to present arrives separately as
 * `AuthState.Pairing`, not as this call's result.
 */
async function requestLogin(reason?: string): Promise<string> {
  return sessionUseCase.requestCoreLogin(await getHostAuthProvider(), reason);
}

function disconnectSession(): Promise<void> {
  return truapiRuntime.get().runtime?.disconnectSession() ?? Promise.resolve();
}

function dispose(): void {
  truapiRuntime.get().runtime?.dispose();
  truapiRuntime.set({ runtime: null, authState: null, loggingOut: false });
  starting = null;
  authResolved = null;
  runtimeReady = null;
  activatedRuntime = null;
  sessionActivated = null;
  hostAuthProvider = null;
}

export const truapiRuntimeUseCase = {
  start,
  toUserId,
  getChatIdentityKey,
  watchSessionTeardown,
  requestLogin,
  createProvider,
  acquireWorker,
  releaseWorker,
  publishAuthState,
  whenAuthResolved,
  whenRuntimeReady,
  disconnectSession,
  dispose,
};
