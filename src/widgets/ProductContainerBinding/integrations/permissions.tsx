import { GenericError } from '@novasamatech/host-api';
import { type Container } from '@novasamatech/host-container';
import { useNavigate } from '@tanstack/react-router';
import { type ResultAsync, fromPromise } from 'neverthrow';
import { type ReactNode, useEffect } from 'react';
import { firstValueFrom } from 'rxjs';

import { useConfirmation } from '@/shared/components';
import { useLooseRef } from '@/shared/hooks';
import { createDefaultRateLimiter } from '@/shared/rateLimiter';
import { useTranslation } from '@/shared/translation';
import {
  type DevicePermissionType,
  type PermissionModality,
  type PermissionStatus,
  clearTransientDevicePermissionGrants,
  grantTransientDevicePermission,
  permissionsService,
  setDevicePermission,
  setRemotePermissionsBatch,
  useDisplayedProduct,
  useProductPermissions,
} from '@/domains/product';
import { DevicePermissionRequestDialog, RemotePermissionRequestDialog } from '@/widgets/Permission';
import { PermissionDeniedDialog } from '../ui/PermissionDeniedDialog';

import { createOnRateLimited } from './_helpers';
import { type PermissionDecision, getPersistedPermissionStatus } from './permissionDecision';
import { createPermissionStatusBridge, getRemoteStatusKey } from './permissionStatusBridge';

const isDevicePermissionName = (permission: string): permission is DevicePermissionType => {
  return permission === 'Camera' || permission === 'Microphone' || permission === 'Bluetooth' || permission === 'Location';
};

const isAppOnlyDevicePermission = (permission: string) =>
  permission === 'Notifications' || permission === 'OpenUrl' || permission === 'Clipboard' || permission === 'Biometrics';

export function usePermissions(container: Container, identifier: string, modality: PermissionModality) {
  const { data: permissions } = useProductPermissions(identifier);
  const permissionsRef = useLooseRef(permissions);
  const { t } = useTranslation();
  const tRef = useLooseRef(t);
  const { data: product } = useDisplayedProduct(identifier);
  const productRef = useLooseRef(product);

  const confirm = useConfirmation();
  const confirmRef = useLooseRef(confirm);

  const navigate = useNavigate();
  const navigateRef = useLooseRef(navigate);

  useEffect(() => {
    const getProductName = () => productRef()?.baseName ?? identifier;
    const rateLimiter = createDefaultRateLimiter({
      onRateLimited: createOnRateLimited(identifier, getProductName, 'permissions', tRef()),
      mapErr: reason => new GenericError({ reason }),
    });

    const navigateToSettingsRoot = () => {
      void navigateRef()({ to: '/settings' });
    };

    const navigateToAppPermissionSettings = (productId: string, permName: string) => {
      // The domain normalizes protocol/storage permission names to the canonical
      // settings id and validates it against PERMISSION_ID_SET (permissions/service.ts).
      // Every PERMISSION_ID is guaranteed a @/widgets/Permission metadata entry
      // (enforced at compile time in metadata.ts), so a truthy result is always routable.
      const permissionId = permissionsService.resolvePermissionMetaId(permName);
      if (permissionId) {
        void navigateRef()({
          to: '/settings/privacy/apps/$productId/$permissionId',
          params: { productId, permissionId },
        });
        return;
      }
      void navigateRef()({ to: '/settings/privacy/apps/$productId', params: { productId } });
    };

    const showDeniedDialog = (permName: string, confirmType: 'device' | 'remote', deniedAt: 'app' | 'system') => {
      const openPrimarySettings = async () => {
        if (deniedAt === 'app') {
          navigateToAppPermissionSettings(identifier, permName);
          return;
        }

        if (permName === 'Camera' || permName === 'Microphone') {
          const opened = await window.App?.openSystemPrivacySettings?.(permName);
          if (opened) return;
        }

        navigateToSettingsRoot();
      };

      const shown = confirmRef()(`${identifier}-permissionDenied-${confirmType}-${permName}`, ({ resolve }) => (
        <PermissionDeniedDialog
          permission={permName}
          deniedAt={deniedAt}
          onOpenPrimarySettings={openPrimarySettings}
          onClose={resolve}
        />
      ));

      return fromPromise(shown, e => new GenericError({ reason: String(e) })).map(() => false);
    };

    const ensureSystemDevicePermission = (permName: string, ok: (value: boolean) => ResultAsync<boolean, never>) => {
      // App-only device permissions have no OS gate — an in-app grant is sufficient.
      if (isAppOnlyDevicePermission(permName)) {
        return ok(true);
      }

      if (!isDevicePermissionName(permName)) {
        return ok(false);
      }

      return fromPromise(window.App.requestSystemDevicePermission(permName), e => new GenericError({ reason: String(e) }))
        .andThen(granted => {
          if (granted) return ok(true);
          return showDeniedDialog(permName, 'device', 'system');
        })
        .orElse(() => showDeniedDialog(permName, 'device', 'system'));
    };

    const statusBridge = createPermissionStatusBridge();

    const persistDevicePermission = (permName: DevicePermissionType, status: PermissionStatus) =>
      firstValueFrom(
        setDevicePermission({
          productId: identifier,
          permission: { payload: { name: permName }, modality, status },
        }),
      ).then(() => {
        statusBridge.setOverride(permName, status);
      });

    const persistRemotePermissions = (
      request: Parameters<typeof permissionsService.buildRemotePermissionsToStore>[0],
      status: PermissionStatus,
    ) =>
      firstValueFrom(
        setRemotePermissionsBatch({
          productId: identifier,
          permissions: permissionsService.buildRemotePermissionsToStore(request, status, modality),
        }),
      ).then(() => {
        statusBridge.setOverride(getRemoteStatusKey(request), status);
      });

    const handlePermission = (
      permName: string,
      confirmType: 'device' | 'remote',
      getStatus: () => PermissionStatus | undefined,
      storePermission: (status: PermissionStatus) => Promise<void>,
      ok: (value: boolean) => ResultAsync<boolean, never>,
      renderAskDialog: (helpers: {
        allowAlways: VoidFunction;
        allowOnce: VoidFunction;
        deny: VoidFunction;
        dismiss: VoidFunction;
      }) => ReactNode,
    ) => {
      const status = getStatus() ?? 'ask';

      if (status === 'granted') {
        if (confirmType === 'device') {
          return ensureSystemDevicePermission(permName, ok);
        }
        return ok(true);
      }

      if (status === 'denied') {
        return showDeniedDialog(permName, confirmType, 'app');
      }

      const asked = confirmRef()<PermissionDecision>(`${identifier}-${confirmType}Permission-${permName}`, ({ resolve }) =>
        renderAskDialog({
          allowAlways: () => resolve('allow-always'),
          allowOnce: () => resolve('allow-once'),
          deny: () => resolve('deny'),
          dismiss: () => resolve('dismiss'),
        }),
      );

      return fromPromise(asked, e => new GenericError({ reason: String(e) }))
        .andThen(decision => {
          if (decision === 'dismiss') {
            return ok(false);
          }

          const persistedStatus = getPersistedPermissionStatus(decision);
          if (persistedStatus) {
            return fromPromise(storePermission(persistedStatus), e => new GenericError({ reason: String(e) })).andThen(() => {
              if (decision === 'deny') {
                return ok(false);
              }

              if (confirmType === 'device') {
                // Allow-always persists 'granted' (already reaches the native gate);
                // allow-once persists 'ask', so it needs a session-scoped transient
                // grant for the native getUserMedia gate to open the device this session.
                if (decision === 'allow-once' && isDevicePermissionName(permName)) {
                  grantTransientDevicePermission({ productId: identifier, permission: permName, modality });
                }
                return ensureSystemDevicePermission(permName, ok);
              }

              return ok(true);
            });
          }

          if (confirmType === 'device') {
            return ensureSystemDevicePermission(permName, ok);
          }

          return ok(true);
        })
        .orElse(() =>
          fromPromise(storePermission('denied'), e => new GenericError({ reason: String(e) })).andThen(() => ok(false)),
        );
    };

    const cleanupDevicePermission = container.handleDevicePermission((permission, { ok }) => {
      // NFC is not supported in desktop app
      if (permission === 'NFC') {
        return ok(false);
      }

      return rateLimiter.schedule(() =>
        handlePermission(
          permission,
          'device',
          () =>
            statusBridge.getStatus(permission, () =>
              permissionsService.getDevicePermissionStatus(permissionsRef(), permission, modality),
            ),
          status => persistDevicePermission(permission, status),
          ok,
          ({ allowAlways, allowOnce, deny, dismiss }) => (
            <DevicePermissionRequestDialog
              isOpen
              productId={identifier}
              permission={permission}
              onAllowAlways={allowAlways}
              onAllowOnce={allowOnce}
              onDeny={deny}
              onDismiss={dismiss}
            />
          ),
        ),
      );
    });

    const cleanupRemotePermission = container.handlePermission((request, { ok }) => {
      const permName = request.tag;
      const remoteRequest = request.tag === 'Remote' ? { tag: 'Remote' as const, value: request.value } : { tag: request.tag };

      return rateLimiter.schedule(() =>
        handlePermission(
          permName,
          'remote',
          () =>
            statusBridge.getStatus(getRemoteStatusKey(remoteRequest), () =>
              permissionsService.getRemotePermissionRequestStatus(permissionsRef(), remoteRequest, modality),
            ),
          status => persistRemotePermissions(remoteRequest, status),
          ok,
          ({ allowAlways, allowOnce, deny, dismiss }) => (
            <RemotePermissionRequestDialog
              isOpen
              productId={identifier}
              permission={permName}
              values={request.tag === 'Remote' ? request.value : null}
              onAllowAlways={allowAlways}
              onAllowOnce={allowOnce}
              onDeny={deny}
              onDismiss={dismiss}
            />
          ),
        ),
      );
    });

    return () => {
      cleanupDevicePermission();
      cleanupRemotePermission();
      rateLimiter.destroy();
      // Session-scoped allow-once grants die with the product session. This cleanup
      // runs on unmount (product close) and on remount (product reload — the webview
      // subtree remounts on refresh), so the next device use re-prompts.
      clearTransientDevicePermissionGrants({ productId: identifier, modality });
    };
  }, [container, identifier, modality]);
}
