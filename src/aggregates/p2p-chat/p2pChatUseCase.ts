import { AccountId } from '@polkadot-api/substrate-bindings';

import { lazyClient, loadDeviceIdentity, loadUserIdentity, statementStoreAdapter } from '@/domains/application';
import { createP2PChatManagerV2 } from '@/domains/chat';

import { p2pChatManager$ } from './state/manager';

/**
 * Owns the P2P chat manager's lifecycle as cross-cutting runtime state.
 *
 * The manager is a domain orchestration primitive (`createP2PChatManagerV2`);
 * *when it exists* is an aggregate concern. `initialize` constructs it once the
 * SSO V2 identity is available and publishes it to `p2pChatManagerState`;
 * `dispose` tears it down on logout. Both are idempotent against the current
 * state so the React binding can call them freely from effects.
 */

let initInFlight = false;
let disposeRequestedDuringInit = false;

async function initialize(): Promise<void> {
  if (p2pChatManager$.get() || initInFlight) return;
  initInFlight = true;
  disposeRequestedDuringInit = false;

  try {
    // The V2 pairing signal is the SDK-owned device + user identity, not the
    // session id surfaced by `useSession()`. Until the identity persists, defer
    // — the binding re-invokes when the session settles into the V2 identity.
    const [device, userIdentity] = await Promise.all([loadDeviceIdentity(), loadUserIdentity()]);
    if (!device || !userIdentity) return;

    // userId must be SS58(device.statementAccountPublicKey) to match the
    // V2 session's localAccount and the device-sync `ownUserId`, so synced
    // rooms land under the userId the chat list reads.
    const userId = AccountId().dec(device.statementAccountPublicKey);

    const manager = await createP2PChatManagerV2({
      statementStore: statementStoreAdapter,
      lazyClient,
      userId,
      device,
      userIdentity,
    });

    await manager.initialize();

    // A dispose() that raced in while we were awaiting wins — drop this one.
    if (disposeRequestedDuringInit) {
      manager.dispose();
      return;
    }

    p2pChatManager$.set(manager);
  } catch (e) {
    console.error('[p2p-chat] Failed to initialize P2P chat manager:', e);
  } finally {
    initInFlight = false;
  }
}

function dispose(): void {
  if (initInFlight) disposeRequestedDuringInit = true;
  const manager = p2pChatManager$.get();
  if (!manager) return;
  p2pChatManager$.set(null);
  manager.dispose();
}

export const p2pChatUseCase = {
  initialize,
  dispose,
};
