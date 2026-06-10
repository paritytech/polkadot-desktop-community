/* eslint-disable import-x/max-dependencies */
import { AccountId } from '@polkadot-api/substrate-bindings';

import { AUTOTEST_ENABLED, E2E_TEST_ENABLED } from '@/shared/autotest';
import { deleteLegacyDatabases } from '@/shared/database';
import { isDev, isElectron, isWeb } from '@/shared/env';
import { registerFeatures } from '@/shared/feature';
import {
  environmentService,
  environmentUseCase,
  failActivePeopleChain,
  hydrateUserIdentity,
  lazyClient,
  loadDeviceIdentity,
  migrateLegacySsoSessions,
  setActivePeopleChain,
  watchHostPappSessionTeardown,
} from '@/domains/application';
import { createPeerResolver } from '@/domains/chat/p2p/peerResolver';
import { type ConsumerInfoLookup, createDeviceSyncTransport, startDeviceSyncIfReady } from '@/domains/device-sync';
import { chainResource, initChainConnectionLifecycle } from '@/domains/network';
import { bootstrapProduct, offlineCacheUseCase, resolveProductUseCase } from '@/domains/product';
import { bootstrapRemoteConfig, refreshRemoteConfig, remoteConfigReady } from '@/domains/remote-config';
import { userIdentity$ } from '@/domains/sso';
import { productManagementUseCase } from '@/aggregates/product-management';
import { appShellFeature } from '@/features/app-shell';
import { browserFeature } from '@/features/browser';
import { chatFeature } from '@/features/chat';
import { customChainsFeature } from '@/features/custom-chains';
import { dashboardFeature } from '@/features/dashboard';
import { bootstrapNotifications, notificationsFeature } from '@/features/notifications';
import { offlineAccessFeature } from '@/features/offline-access';
import { onboardingFeature } from '@/features/onboarding';
import { permissionSettingsFeature } from '@/features/permission-settings';
import { productActionsMenuFeature } from '@/features/product-actions-menu';
import { productSettingsFeature } from '@/features/product-settings';
import { productWidgetFeature } from '@/features/product-widget';
import { productWorkerFeature } from '@/features/product-worker';
import { settingsFeature } from '@/features/settings';
import { signingBotAutopairFeature } from '@/features/signing-bot-autopair';
import { statementStoreNetworkFeature } from '@/features/statement-store-network';
import { themeToggleFeature } from '@/features/theme-toggle';
import { updateCheckFeature } from '@/features/update-check';
import { userManagerFeature } from '@/features/user-manager';

// Idempotency guard: re-mounting <App/> must NOT spawn a second device-sync
// orchestrator (duplicate state machines → duplicate Updates with id=1..N).
let bootstrapped = false;

export const bootstrap = async () => {
  if (bootstrapped) return;
  bootstrapped = true;

  // All config comes from Remote Config (no fallback), so await the first
  // fetch/activate before anything reads config.
  bootstrapRemoteConfig({
    apiKey: import.meta.env['VITE_FIREBASE_API_KEY'],
    projectId: import.meta.env['VITE_FIREBASE_PROJECT_ID'],
    appId: import.meta.env['VITE_FIREBASE_APP_ID'],
    // Selects the RC channel via the `environment` custom signal.
    environment: environmentService.getActiveId(),
    minimumFetchIntervalMillis: isDev() ? 0 : undefined,
  });
  await remoteConfigReady;

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

  migrateLegacySsoSessions();

  // Wire the product domain's host IPC handlers up front, before any product can
  // run. Test runs deny unmatched remote-URL requests instead of prompting.
  bootstrapProduct({ promptForUnmatchedRemoteAccess: !AUTOTEST_ENABLED && !E2E_TEST_ENABLED });

  // Branch-era databases consolidated into polkadot-desktop-app-v1. Best-effort.
  void deleteLegacyDatabases();

  initChainConnectionLifecycle();

  // V2 multi-device identity is owned by the SDK (host-papp); the app reads it
  // back via `@/domains/application`. The device-sync/SSO stack is Electron-only.
  if (isElectron()) {
    const peerResolver = await createPeerResolver(lazyClient, environmentService.getActiveId());

    const resolveConsumerInfo: ConsumerInfoLookup = async accountId => {
      const [chatKey, username] = await Promise.all([
        peerResolver.getPeerP256Key(accountId),
        peerResolver.getUsername(accountId),
      ]);
      if (!chatKey || !username) return null;
      return { chatKey, username };
    };

    // React to identity establishment / rotation / logout. A fresh SSO V2
    // handshake mid-session emits a new userIdentity here, so the orchestrator
    // starts without waiting for an app relaunch. The device identity is only
    // present once paired, so we load it per-identity from the SDK.
    let currentStop: VoidFunction | null = null;
    let currentToken = 0;
    userIdentity$.value$.subscribe(userIdentity => {
      const token = ++currentToken;
      if (currentStop) {
        currentStop();
        currentStop = null;
      }
      if (!userIdentity) return;

      void loadDeviceIdentity()
        .then(device => {
          // Identity changed (or cleared) while the device load was in flight —
          // a newer subscription pass owns the world now.
          if (token !== currentToken) return;
          if (!device) {
            console.error('[bootstrap] user identity present but no device identity in the SDK — skipping device-sync');
            return;
          }

          const transport = createDeviceSyncTransport(device.statementAccountSeed);

          // VITE_WEBRTC_TURN_TTL (seconds) overrides the credential lifetime; unset/invalid → NaN → builder default.
          const turnTtl = Number(import.meta.env['VITE_WEBRTC_TURN_TTL']);

          return startDeviceSyncIfReady({
            device,
            userIdentity,
            // Seed with the authorising PApp device captured at handshake; the
            // full roster lands via `SyncEntity.Devices` once the DC is open.
            fetchInitialPeers: () =>
              Promise.resolve([
                {
                  statementAccountId: userIdentity.peerDeviceStatementAccountId,
                  encryptionPublicKey: userIdentity.peerDeviceEncPubKey,
                },
              ]),
            subscribeStatementTopic: transport.subscribeStatementTopic,
            postStatement: transport.postStatement,
            resolveConsumerInfo,
            // Must match the chat manager's `userId` (which is `SS58(device.statementAccountPublicKey)`
            // for V2 sessions — the V2 session's `localAccount`) so synced rooms land under the same
            // `P2PRoom.userId` the chat-list hook queries against. Using `identitySr25519PublicKey`
            // here writes synced rooms with a userId the UI never reads.
            ownUserId: AccountId().dec(device.statementAccountPublicKey),
            iceConfig: {
              turnHost: import.meta.env['VITE_WEBRTC_TURN_HOST'],
              turnSecret: import.meta.env['VITE_WEBRTC_TURN_SECRET'],
              turnTtlSeconds: turnTtl > 0 ? turnTtl : undefined,
            },
          }).then(stop => {
            if (token !== currentToken) {
              // Identity changed (or cleared) while we were starting — drop
              // this stale handle so the newer subscription owns the world.
              stop();
              return;
            }
            currentStop = stop;
          });
        })
        .catch((error: unknown) => {
          console.error('Failed to start device-sync orchestrator:', error);
        });
    });

    hydrateUserIdentity().catch((error: unknown) => {
      console.error('Failed to hydrate user identity:', error);
    });

    // Single local-teardown path on the host-papp session list (see
    // `watchHostPappSessionTeardown`).
    void watchHostPappSessionTeardown();
  }

  registerFeatures([
    appShellFeature,
    dashboardFeature,
    browserFeature,
    productActionsMenuFeature,
    offlineAccessFeature,
    chatFeature,
    settingsFeature,
    updateCheckFeature,
    productWidgetFeature,
    productWorkerFeature,
    userManagerFeature,
    themeToggleFeature,
    productSettingsFeature,
    permissionSettingsFeature,
    statementStoreNetworkFeature,
    onboardingFeature,
    customChainsFeature,
    signingBotAutopairFeature,
    notificationsFeature,
  ]);

  // Cancel notifications for products uninstalled while the app was closed.
  bootstrapNotifications();

  // First run only: give a brand-new user the default dashboard (layout +
  // default product). No-op once a dashboard exists.
  void productManagementUseCase.ensureDefaultDashboard();

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
};

const persist = () => {
  if (isWeb() && navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then(persistent => {
      if (!persistent) console.warn('Storage may be cleared by the UA under storage pressure.');
    });
  }
};
