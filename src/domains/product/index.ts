// Product container — canonical entity, persistence, and the nested manifest
// sub-module (product manifest wire schemas + per-executable archive loader). Top-
// level product discovery lives in `$usecase/resolve.ts`, not here.
export type {
  AppExecutable,
  Executable,
  ExecutableContent,
  ExecutableKind,
  Icon,
  PersistedProduct,
  Product,
  ProductArchive,
  ProductExecutables,
  RootManifest,
  WidgetExecutable,
  WorkerExecutable,
} from './product';
export type { ExecutableCacheStatus } from './product/executable-cache/types';
export {
  EXECUTABLE_KINDS,
  executableArchiveResource,
  manifestService,
  productDb,
  productService,
  productsResource,
  useDisplayedProduct,
  useExecutableArchive,
  useIsPinned,
  useIsProductInstalled,
  useLiveExecutableContenthash,
  usePersistedProductById,
  usePersistedProducts,
  useProductHeaderProps,
  useProductIcon,
} from './product';
export type { ProductHeaderViewModel } from './product';

// Host-environment wiring — call once from the app bootstrap (never at import time).
export { bootstrapProduct } from './bootstrap';

// Use cases — imperative product flows (multi-step writes / cross-module read
// composition). Each group is exported separately per project structure.
export { lifecycleUseCase } from './$usecase/lifecycle';
export { offlineCacheUseCase } from './$usecase/offlineCache';
export { productLocalStorageRepository } from './local-storage/repository';
export { resolveProductUseCase } from './$usecase/resolve';
export { usePinProduct, useUnpinProduct } from './$usecase/commitment.hooks';
export { useInteractedProducts } from './$usecase/interaction.hooks';
export { useOfflineCacheStatus } from './product/executable-cache/hooks';
export { commitmentUseCase } from './$usecase/commitment';

export type { AppListing } from './browse';
export { browseGateway, browseService, usePublishedWidgetListings } from './browse';

export { dotNsService } from './dotns/service';
export { isLocalhostUrl, normalizeLocalhostUrl } from './dotns/localhost';
export { dotNsGateway } from './dotns/gateway';
export type { DotNsUrl } from './dotns/types';

export { productAccountService } from './account/service';

export { aliasPermissionService } from './alias-permissions/service';
export { useAllAliasPermissions, useRemoveAliasPermission, useSetAliasPermission } from './alias-permissions/hooks';
export type { AliasPermission, AliasPermissionStatus } from './alias-permissions/types';

export type { Binding, FetchResolver, ProductWorkerInstance, Sandbox, WorkerDeps, WorkerEvents } from './worker/types';
export { createProductWorker } from './worker/instance';
export { defaultWorkerBindings } from './worker/bindings';

export type {
  AggregatedPermission,
  AppPermissionEntry,
  DevicePermissionType,
  Permission,
  PermissionStatus,
  ProductPermissions,
  RemotePermissionIpcRequest,
  RemotePermissionRequest,
} from './permissions/types';
export { type PermissionId, type PermissionModality, PERMISSION_IDS } from './permissions/constants';
export {
  useAggregatedPermission,
  useAggregatedPermissions,
  useAllProductPermissions,
  useProductExternalRequestPatterns,
  useProductPermissions,
  useResetPermissionToDefault,
  useSetDevicePermission,
  useSetRemotePermission,
  useSetRemotePermissionsBatch,
} from './permissions/hooks';
export {
  clearTransientDevicePermissionGrants,
  grantTransientDevicePermission,
  resetPermissionToDefault,
  setDevicePermission,
  setRemotePermission,
  setRemotePermissionsBatch,
} from './permissions/resource';
export { permissionsService } from './permissions/service';
export type { DevicePermissionId } from './permissions/types';
export { _resetRemotePermissionBroker, pendingRemotePermissionRequests$, requestExternalUrlAccess } from './permissions/broker';
export type { PendingRemotePermissionRequest } from './permissions/broker';
