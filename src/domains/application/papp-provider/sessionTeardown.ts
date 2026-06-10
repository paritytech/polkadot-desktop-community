import { userIdentity$ } from '@/domains/sso';

import { ensurePappProvider } from './provider';
import { performUserLogout } from './service';

/**
 * Single local-teardown path, mirroring dotli's auth module.
 *
 * Every way out of an authenticated session removes the host-papp `UserSession`:
 *   - the Log Out button (`auth.disconnect`),
 *   - a network switch (`TestnetSettings` → `auth.disconnect`),
 *   - a peer-initiated `Disconnected` (host-papp's session manager receives it
 *     on the live channel and drops the session).
 *
 * So we observe the SDK's session list and run the full local logout (rotate
 * device identity + wipe per-user state + reload) whenever the session vanishes
 * while we still hold a V2 identity. host-papp owns the wire send/receive —
 * desktop no longer maintains its own SSO `Disconnected` channel.
 */
export const watchHostPappSessionTeardown = async (): Promise<void> => {
  const adapter = await ensurePappProvider();

  let hadSession = adapter.sessions.sessions.read().length > 0;
  // One-way latch: `performUserLogout` ends in a renderer reload, so once teardown
  // starts we're committed. Without this, a second `sessions` emission arriving
  // before the reload commits could fire a concurrent second teardown — the
  // `userIdentity$` guard alone has a TOCTOU window because `runV2Logout` nulls
  // `userIdentity$` only after awaiting the repo wipes.
  let tearingDown = false;
  adapter.sessions.sessions.subscribe(sessions => {
    const hasSession = sessions.length > 0;
    if (hadSession && !hasSession && !tearingDown && userIdentity$.get() !== null) {
      tearingDown = true;
      console.info('[sso] host-papp session removed while authenticated — running full user logout');
      void performUserLogout();
    }
    hadSession = hasSession;
  });
};
