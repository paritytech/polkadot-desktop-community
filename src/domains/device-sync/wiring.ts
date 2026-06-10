/**
 * One-shot start of device-sync. Checks feature flag + identity; if both are
 * ready, starts the orchestrator. Returns its stop fn (no-op when skipped).
 *
 * Bootstrap subscribes to `userIdentity$` and calls this on every emission
 * (after stopping any previous run), so a fresh SSO V2 handshake mid-session
 * spawns the orchestrator without an app relaunch.
 */

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
  });

  return handle.stop;
}
