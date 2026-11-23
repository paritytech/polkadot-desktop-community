import { ensureSubstrateSlotSr25519Ready } from '@novasamatech/statement-store';
import { AccountId } from '@polkadot-api/substrate-bindings';
import { fromHex, toHex } from 'polkadot-api/utils';

import { statementStoreAdapter } from '@/domains/application';
import { createP2PChatManagerV2 } from '@/domains/chat';
import { type DeviceIdentity, type UserIdentity, deviceIdentityService } from '@/domains/device';
import { truapiRuntime, truapiRuntimeUseCase } from '@/aggregates/truapi-runtime';

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

/**
 * The paired user's identity, as the core reports it.
 *
 * Every public half comes off `SessionUiInfo`; the chat secret is an explicit
 * `CoreAdmin` read. `null` whenever the session is absent or missing a field the
 * channel cannot run without — a partial identity would open a channel no peer can
 * reach, which is worse than not opening one.
 *
 * `ssoEncPubKey` is always `null`: it marked a Mobile SSO v0.2.2 peer capability
 * that nothing consumes now that signing runs in the core.
 */
async function loadUserIdentity(): Promise<UserIdentity | null> {
  const authState = truapiRuntime.get().authState;
  if (authState?.tag !== 'Connected') return null;

  const { chatPublicKey, identityAccountId, publicKey, peerDeviceEncPublicKey, peerStatementAccountId } = authState.value;
  if (!chatPublicKey || !identityAccountId || !peerDeviceEncPublicKey || !peerStatementAccountId) return null;

  const chatSecret = await truapiRuntimeUseCase.getChatIdentityKey();
  if (!chatSecret) return null;

  return {
    identityChatPublicKey: fromHex(chatPublicKey),
    identityChatPrivateKey: fromHex(chatSecret),
    identitySr25519PublicKey: fromHex(identityAccountId),
    rootSr25519PublicKey: fromHex(publicKey),
    peerDeviceEncPubKey: fromHex(peerDeviceEncPublicKey),
    peerDeviceStatementAccountId: fromHex(peerStatementAccountId),
    ssoEncPubKey: null,
  };
}

/**
 * This device's identity, as the core reports it for the active session.
 *
 * The wallet registered these keys at pairing: it holds a statement allowance for
 * `deviceStatementAccountId` and announces `deviceEncPublicKey` to contacts. Signing
 * or decrypting with any other key sends statements no allowance covers and misses
 * what contacts send. `null` until both secrets exist, or when a secret does not
 * match the public half the session reports.
 */
async function loadDeviceIdentity(): Promise<DeviceIdentity | null> {
  const authState = truapiRuntime.get().authState;
  if (authState?.tag !== 'Connected') return null;

  const { deviceStatementAccountId, deviceEncPublicKey } = authState.value;
  if (!deviceStatementAccountId || !deviceEncPublicKey) return null;

  const keys = await truapiRuntimeUseCase.getDeviceKeys();
  if (!keys) return null;

  // The canonical API reads the core's statement account secret and its wasm loads asynchronously. Every signer of
  // that secret runs in the manager built from this identity, so awaiting here covers them all.
  await ensureSubstrateSlotSr25519Ready();

  const statementAccountPublicKey = deviceIdentityService.deriveStatementAccountPublicKey(keys.statementKey);
  const encryptionPublicKey = deviceIdentityService.deriveEncryptionPublicKey(keys.encryptionKey);
  const sameKey = (derived: Uint8Array, reported: string) => toHex(derived) === reported.toLowerCase();
  if (!sameKey(statementAccountPublicKey, deviceStatementAccountId) || !sameKey(encryptionPublicKey, deviceEncPublicKey)) {
    console.error('[p2p-chat] the core device secrets do not match the session public keys');

    return null;
  }

  return {
    statementAccountSeed: keys.statementKey,
    statementAccountPublicKey,
    encryptionPrivateKey: keys.encryptionKey,
    encryptionPublicKey,
  };
}

async function initialize(): Promise<void> {
  if (p2pChatManager$.get() || initInFlight) return;
  initInFlight = true;
  disposeRequestedDuringInit = false;

  try {
    // Both identities come from the core session; until it is paired there is
    // nothing to run a channel for — the binding re-invokes when the session settles.
    const [device, userIdentity] = await Promise.all([loadDeviceIdentity(), loadUserIdentity()]);
    if (!device || !userIdentity) return;

    // userId must be SS58(device.statementAccountPublicKey) to match the
    // V2 session's localAccount and the device-sync `ownUserId`, so synced
    // rooms land under the userId the chat list reads.
    const userId = AccountId().dec(device.statementAccountPublicKey);

    const manager = await createP2PChatManagerV2({
      statementStore: statementStoreAdapter,
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
