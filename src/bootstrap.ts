/* eslint-disable import-x/max-dependencies */
import { asProductId } from '@parity/truapi';

import { AUTOTEST_ENABLED, E2E_TEST_ENABLED } from '@/shared/autotest';
import { deleteLegacyDatabases } from '@/shared/database';
import { isDev, isElectron, isProductionBuild, isWeb } from '@/shared/env';
import { registerFeatures } from '@/shared/feature';
import {
  environmentUseCase,
  failActivePeopleChain,
  setActivePeopleChain,
  web3SummitGateModeSchema,
  web3SummitGateService,
} from '@/domains/application';
import { chainResource, initChainConnectionLifecycle, initConnectionModeSwitch, initLightClient } from '@/domains/network';
import {
  bootstrapProduct,
  offlineCacheUseCase,
  permissionsService,
  permissionsUseCase,
  resolveProductUseCase,
} from '@/domains/product';
import {
  REMOTE_CONFIG_KEYS,
  bootstrapRemoteConfig,
  refreshRemoteConfig,
  remoteConfigGateway,
  remoteConfigReady,
} from '@/domains/remote-config';
import { productManagementUseCase } from '@/aggregates/product-management';
import { productWorkersUseCase } from '@/aggregates/product-workers';
import { truapiRuntimeUseCase } from '@/aggregates/truapi-runtime';
import { appShellFeature } from '@/features/app-shell';
import { browserFeature } from '@/features/browser';
import { callFeature } from '@/features/call';
import { chatFeature } from '@/features/chat';
import { customChainsFeature } from '@/features/custom-chains';
import { dashboardFeature } from '@/features/dashboard';
import { favoritesFeature } from '@/features/favorites';
import { inputModalityFeature } from '@/features/input-modality';
import { languageSettingsFeature } from '@/features/language-settings';
import { networkConnectionFeature } from '@/features/network-connection';
import { bootstrapNotifications, notificationsFeature } from '@/features/notifications';
import { offlineAccessFeature } from '@/features/offline-access';
import { onboardingFeature } from '@/features/onboarding';
import { permissionSettingsFeature } from '@/features/permission-settings';
import { productActionsMenuFeature } from '@/features/product-actions-menu';
import { productDashboardFeature } from '@/features/product-dashboard';
import { bootstrapProductRuntime, productRuntimeFeature } from '@/features/product-runtime';
import { productSettingsFeature } from '@/features/product-settings';
import { productWidgetFeature } from '@/features/product-widget';
import { productWorkerFeature } from '@/features/product-worker';
import { settingsFeature } from '@/features/settings';
import { statementStoreNetworkFeature } from '@/features/statement-store-network';
import { themeToggleFeature } from '@/features/theme-toggle';
import { updateCheckFeature } from '@/features/update-check';
import { userManagerFeature } from '@/features/user-manager';

export type BootstrapOutcome = { status: 'ready' } | { status: 'w3s-ended' };

// Idempotency guard: re-mounting <App/> must NOT spawn a second device-sync
// orchestrator (duplicate state machines → duplicate Updates with id=1..N).
// Caching the in-flight promise (not just a completed flag) coalesces any
// re-entry — even mid-flight — onto the single original run.
let bootstrapPromise: Promise<BootstrapOutcome> | null = null;

export const bootstrap = (): Promise<BootstrapOutcome> => (bootstrapPromise ??= runBootstrap());

const runBootstrap = async (): Promise<BootstrapOutcome> => {
  // All config comes from Remote Config (no fallback), so await the first
  // fetch/activate before anything reads config.
  bootstrapRemoteConfig({
    apiKey: import.meta.env['VITE_FIREBASE_API_KEY'],
    projectId: import.meta.env['VITE_FIREBASE_PROJECT_ID'],
    appId: import.meta.env['VITE_FIREBASE_APP_ID'],
    // Selects the RC channel via the `environment` custom signal.
    environment: environmentUseCase.getActiveId(),
    minimumFetchIntervalMillis: isDev() ? 0 : undefined,
  });
  await remoteConfigReady;

  const gateMode = web3SummitGateService.resolveGateMode(
    remoteConfigGateway.tryGetString(REMOTE_CONFIG_KEYS.w3sGateMode, web3SummitGateModeSchema),
  );
  if (web3SummitGateService.isW3sEnded(gateMode)) {
    return { status: 'w3s-ended' };
  }

  // Seed the statement-store people chain. On failure, reject its deferred (so
  // pending queries fail fast) and rethrow — App renders the error screen.
  let activeEnvironment;
  try {
    try {
      activeEnvironment = await environmentUseCase.getActive();
    } catch {
      // The fetch throttle is time-based, so RC can serve a stale or
      // wrong-channel chains_v2 (e.g. right after a channel switch). Force a
      // fresh fetch, drop the cached catalog, and retry once.
      await refreshRemoteConfig();
      chainResource.invalidateAll();
      activeEnvironment = await environmentUseCase.getActive();
    }
    setActivePeopleChain(activeEnvironment.peopleChain);
  } catch (error) {
    failActivePeopleChain(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }

  // Wire the product domain's host IPC handlers up front, before any product can
  // run. Test runs deny unmatched remote-URL requests instead of prompting.
  bootstrapProduct({
    promptForUnmatchedRemoteAccess: !AUTOTEST_ENABLED && !E2E_TEST_ENABLED,
    // Lazy: the core runtime is created asynchronously and does not exist yet at this
    // point. Each call awaits the handle instead of capturing it. The domain bounds
    // these calls, so a runtime that never starts fails closed rather than hanging.
    permissionsAdapter: {
      getStatus: async (productId, request) =>
        (await truapiRuntimeUseCase.whenRuntimeReady()).getPermissionAuthorizationStatus(asProductId(productId), request),
      getStatuses: async (productId, requests) =>
        (await truapiRuntimeUseCase.whenRuntimeReady()).getPermissionAuthorizationStatuses(asProductId(productId), requests),
      setStatus: async (productId, request, status) =>
        (await truapiRuntimeUseCase.whenRuntimeReady()).setPermissionAuthorizationStatus(asProductId(productId), request, status),
    },
  });

  // Test-only hook: grant a remote-URL permission through the core, the same path an
  // "Allow always" takes. e2e reaches domain code only through `window`, and permissions
  // are core-owned, so a raw storage seed cannot work. `setPermissionStatus` awaits the
  // runtime, so this resolves once the core is up.
  if (AUTOTEST_ENABLED || E2E_TEST_ENABLED) {
    window.__grantRemoteUrlPermission = async (productId, url) => {
      const request = permissionsService.toAuthorizationRequest('ExternalRequest', { pattern: url });
      if (request) await permissionsUseCase.setPermissionStatus({ productId, request, status: 'granted' });
    };
  }

  // Branch-era databases consolidated into polkadot-desktop-app-v1. Best-effort.
  void deleteLegacyDatabases();

  initChainConnectionLifecycle();
  initConnectionModeSwitch();

  // Run the workers the core says are wanted. Deliberately not awaited: it waits for
  // the runtime, which is started later by a React binding, and boot must not block
  // on that.
  void productWorkersUseCase.watchDemand().catch((error: unknown) => {
    console.error('[bootstrap] product worker demand watcher failed to start', error);
  });

  // Boot the embedded light client before any chain is locked, so the (synchronous)
  // availability check the connection layer and the settings UI both make sees the
  // real catalog. Not fatal: on failure every chain falls back to its RPC nodes.
  await initLightClient().catch((error: unknown) => {
    console.error('[bootstrap] light client unavailable — chains will use RPC', error);
  });

  // V2 multi-device identity is owned by the SDK (host-papp); the app reads it
  // back via `@/domains/application`. The device-sync/SSO stack is Electron-only.
  if (isElectron()) {
    // TODO(truapi): re-wire device-sync to the core's session identity in Task 12.
    // It was driven by `userIdentity$`, which host-papp's V2 handshake populated;
    // the core owns the session now and nothing sets that state. Recover the old
    // wiring with `git show 295585d0:src/bootstrap.ts` when the core can expose
    // session-derived identity material (docs/_plans/truapi-upstream-issues.md § 2).

    // Single local-teardown path, now on the core's auth state.
    truapiRuntimeUseCase.watchSessionTeardown();
  }

  registerFeatures([
    appShellFeature,
    dashboardFeature,
    favoritesFeature,
    productDashboardFeature,
    browserFeature,
    productActionsMenuFeature,
    offlineAccessFeature,
    chatFeature,
    callFeature,
    settingsFeature,
    productWidgetFeature,
    productWorkerFeature,
    userManagerFeature,
    languageSettingsFeature,
    inputModalityFeature,
    themeToggleFeature,
    networkConnectionFeature,
    productSettingsFeature,
    permissionSettingsFeature,
    onboardingFeature,
    productRuntimeFeature,
    notificationsFeature,
    ...(isProductionBuild() ? [] : [updateCheckFeature, statementStoreNetworkFeature, customChainsFeature]),
  ]);

  // Cancel notifications for products uninstalled while the app was closed.
  bootstrapNotifications();

  // Boot the TrUAPI core here rather than from a component: the route loaders wait
  // for its first auth report before they let the app render.
  bootstrapProductRuntime(activeEnvironment);

  // First run only: give a brand-new user the default dashboard (layout +
  // default product). No-op once a dashboard exists. The seeded card is named
  // after the network's TLD, so an unreachable dotNS endpoint rejects here —
  // leave the dashboard unseeded rather than write a name that resolves nowhere,
  // and the next launch reseeds.
  productManagementUseCase.ensureDefaultDashboard().catch(() => {
    console.warn('[bootstrap] default dashboard not seeded — the network TLD could not be read');
  });

  // Refresh metadata for installed *unpinned* products against the chain on
  // launch — the explicit, owned trigger for keeping unpinned rows fresh
  // (pinned products are frozen and skipped). Best-effort.
  void resolveProductUseCase.reconcileUnpinnedProducts();

  // Ensure every pinned product's archives are persisted and ready; re-pin any
  // that are missing (e.g. a prefetch that failed offline last session). Best-effort.
  void offlineCacheUseCase.reconcilePinnedArchives();

  // Delete on-disk archives no longer owned by a pinned product (failed/aborted
  // unpin evictions, forgotten leftovers). Best-effort.
  void offlineCacheUseCase.sweepOrphanedArchives();

  persist();

  return { status: 'ready' };
};

const persist = () => {
  if (isWeb() && navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then(persistent => {
      if (!persistent) console.warn('Storage may be cleared by the UA under storage pressure.');
    });
  }
};
