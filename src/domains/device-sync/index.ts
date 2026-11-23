export { type ConsumerInfoLookup } from './applier';
export {
  type DeviceSyncOrchestratorHandle,
  type DeviceSyncOrchestratorParams,
  startDeviceSyncOrchestrator,
} from './orchestrator';
// DEBT: read by `application/papp-provider`, `application/$usecase/session.ts`, `chat/p2p`.
// Fix: a device-sync use case for those three call sites.
// eslint-disable-next-line local-rules/enforce-import-restrictions
export { deviceSyncRepository } from './repository';
// Emit-side of the local-change → sync pump. Consumed by write use cases in
// other domains (e.g. contact) to poke sync after a local mutation. The Subject
// itself stays internal (its createSideEffect conversion is a device-sync task).
export { signalLocalChange } from './localChangeSignal';
export { useDeviceSyncStatus } from './hooks';
export type { ChatIdValue, DeviceSyncStatus, KnownUserDevice } from './types';
export {
  type DeviceSyncIdentityStart,
  type DeviceSyncWiringDeps,
  startDeviceSyncIfReady,
  startDeviceSyncOnIdentity,
} from './wiring';
export { deviceSyncStatusResource } from './resource';
