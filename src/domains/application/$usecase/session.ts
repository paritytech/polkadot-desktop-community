import { createSideEffect } from '@/shared/di';
import { clearAllP2PChatStorage, clearAllProductChatStorage } from '@/domains/chat';
import { contactRepository } from '@/domains/contact';
import { deviceSyncRepository } from '@/domains/device-sync';
import { coreAuthGateway } from '../core-auth/gateway';

const reloadRenderer = () => {
  // Tanstack hash router preserves `#/<path>` across reloads. If the user
  // pressed Log Out from `/dashboard`, a bare reload returns them to
  // `/dashboard` (which has no auth guard); resetting the hash to root makes
  // the `/` route's `userIdentity$` check run and route them to /onboarding.
  if (typeof window !== 'undefined') {
    window.location.hash = '#/';
  }
  window.App?.reload() ?? window.location.reload();
};

/**
 * Tear down all V2 user-identity state and flip `userIdentity$` to `null`.
 *
 * Reached through `performUserLogout`, which the host-papp session-teardown
 * watcher (`watchHostPappSessionTeardown`) runs whenever the SDK session
 * disappears — the Log Out button, a network switch, or a peer-initiated
 * `Disconnected` all remove the session and converge here.
 *
 * Order matters: wipe the per-user repos BEFORE flipping `userIdentity$`. The
 * chat manager and device-sync orchestrator react to `userIdentity$` going null
 * and tear themselves down — if they observe the
 * transition while stale rows still exist on disk, their final reactive pass
 * may rearm against the old user's data and bleed into the next pairing.
 *
 * `onPairingSuccess` on the NEXT login also clears `contactRepository`
 * and `deviceSyncRepository`, but it doesn't run on logout, so we must do it
 * here to keep the previous user's roster + chat history from carrying over.
 *
 * Only *application*-owned state is torn down here. The SDK-owned user identity
 * — the session, its secrets, the allowance slot keys — is host-papp's to drop,
 * and it already has: this runs because the session left `adapter.sessions`,
 * which host-papp only does after purging everything that session persisted.
 * The device keys are the core session's and go with it.
 */
/**
 * Fires during V2 logout, after the application-owned repos are cleared. Domains that persist
 * per-user data register a handler here instead of being called directly: `@/domains/product`
 * already imports `@/domains/application`, so a direct call in the other direction closes an
 * import cycle that `import-x/no-cycle` rejects.
 *
 * Named for the place of use (the logout), not for any provider.
 */
export const onUserLoggedOutSideEffect = createSideEffect<void>({ name: 'onUserLoggedOut' });

const runV2Logout = async (): Promise<void> => {
  // `allSettled`, not `all`: a wipe that rejects (a blocked IndexedDB connection, say)
  // must not strand the user in an authenticated shell. Leftover local data on an
  // otherwise-signed-out app is recoverable; a logout that never completes is not.
  const results = await Promise.allSettled([
    contactRepository.clearAll(),
    deviceSyncRepository.clearAll(),
    clearAllP2PChatStorage(),
    clearAllProductChatStorage(),
  ]);
  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('[sso] logout: per-user storage wipe failed', result.reason);
    }
  }
  // Awaited after the application-owned clears, not alongside them: a handler that
  // throws must not mask a failure in the teardown above. `apply` settles, it never rejects.
  await onUserLoggedOutSideEffect.apply();
};

/**
 * Full user-initiated logout — runs `runV2Logout` (the per-user repos), then
 * reloads. The device keys belong to the core session and rotate with the next
 * login, so there is no host-side identity to reset.
 *
 * The reload at the end resets module-level state captured at startup, so
 * subsequent re-pairs start clean.
 */
const performUserLogout = async (): Promise<void> => {
  try {
    await runV2Logout();
  } catch (error) {
    // `runV2Logout` already clears the identity in its own `finally`, so reloading
    // here still lands on the login screen — reporting beats stalling on this screen.
    console.error('[sso] logout teardown failed; reloading to the login screen anyway', error);
  } finally {
    // The reload is what clears the logout splash and resets startup state.
    reloadRenderer();
  }
};

/**
 * Start a core pairing over the host's auth provider.
 *
 * Thin by design: `gateway.ts` may not sit on the domain barrel
 * (`local-rules/enforce-import-restrictions`), and a single wire call has no cache
 * or identity to justify a resource, so a use case is the sanctioned way for the
 * `truapi-runtime` aggregate to reach it. The provider's lifetime stays with the
 * caller, which owns the one reused auth session.
 */
const requestCoreLogin = (provider: Parameters<typeof coreAuthGateway.requestLogin>[0], reason?: string): Promise<string> =>
  coreAuthGateway.requestLogin(provider, reason);

export const sessionUseCase = {
  requestCoreLogin,
  runV2Logout,
  performUserLogout,
};
