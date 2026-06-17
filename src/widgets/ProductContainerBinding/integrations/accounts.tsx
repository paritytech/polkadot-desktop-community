import {
  type AllocationOutcome,
  type CodecType,
  GetUserIdErr,
  RequestCredentialsErr,
  ResourceAllocationErr,
} from '@novasamatech/host-api';
import { type Container } from '@novasamatech/host-container';
import { useSession, useSessionIdentity } from '@novasamatech/host-papp-react-ui';
import { ResultAsync, fromPromise } from 'neverthrow';
import { useEffect } from 'react';
import { firstValueFrom } from 'rxjs';

import { useConfirmation } from '@/shared/components';
import { useLooseRef, useSubscription } from '@/shared/hooks';
import { createDefaultRateLimiter } from '@/shared/rateLimiter';
import { useTranslation } from '@/shared/translation';
import { toError } from '@/shared/utils';
import {
  type PermissionModality,
  type RemotePermissionRequest,
  aliasPermissionService,
  dotNsService,
  permissionsService,
  productAccountService,
  useAllAliasPermissions,
  useDisplayedProduct,
  useProductPermissions,
  useSetAliasPermission,
  useSetRemotePermissionsBatch,
} from '@/domains/product';
import { RemotePermissionRequestDialog } from '@/widgets/Permission';
import { AliasPermissionModal } from '../ui/AliasPermissionModal';
import { AllocationRequestModal } from '../ui/AllocationRequestModal';

import { createOnRateLimited, pappSsoQueue } from './_helpers';
import { type AliasPermissionDecision, decideAliasPermissionEffect } from './aliasPermissionDecision';
import { type PermissionDecision, getPersistedPermissionStatus } from './permissionDecision';
import { createPermissionStatusBridge } from './permissionStatusBridge';

export function useAccounts(container: Container, identifier: string, modality: PermissionModality) {
  const confirm = useConfirmation();
  const { t } = useTranslation();
  const tRef = useLooseRef(t);
  const { data: product } = useDisplayedProduct(identifier);
  const productRef = useLooseRef(product);
  const { data: aliasPermissions } = useAllAliasPermissions();
  const aliasPermissionsRef = useLooseRef(aliasPermissions);
  const { data: productPermissions } = useProductPermissions(identifier);
  const productPermissionsRef = useLooseRef(productPermissions);
  const setAliasPermission = useSetAliasPermission();
  const setAliasPermissionRef = useLooseRef(setAliasPermission);
  const setRemotePermissionsBatch = useSetRemotePermissionsBatch();
  const setRemotePermissionsBatchRef = useLooseRef(setRemotePermissionsBatch);
  const { session } = useSession();
  const sessionRef = useLooseRef(session);
  const subscribeSession = useSubscription(session);

  const [identity] = useSessionIdentity(session);
  const identityRef = useLooseRef(identity);

  useEffect(() => {
    const abortController = new AbortController();
    const getProductName = () => productRef()?.baseName ?? identifier;
    const rateLimiterGetLegacyAccounts = createDefaultRateLimiter({
      onRateLimited: createOnRateLimited(identifier, getProductName, 'legacyAccounts', tRef()),
      mapErr: reason => new RequestCredentialsErr.Unknown({ reason }),
    });
    const rateLimiterGetIdentityAccount = createDefaultRateLimiter({
      onRateLimited: createOnRateLimited(identifier, getProductName, 'identityAccount', tRef()),
      mapErr: reason => new RequestCredentialsErr.Unknown({ reason }),
    });
    const rateLimiterProductAccounts = createDefaultRateLimiter({
      onRateLimited: createOnRateLimited(identifier, getProductName, 'productAccounts', tRef()),
      mapErr: reason => new RequestCredentialsErr.Unknown({ reason }),
    });
    const rateLimiterGetAlias = createDefaultRateLimiter({
      onRateLimited: createOnRateLimited(identifier, getProductName, 'alias', tRef()),
      mapErr: reason => new RequestCredentialsErr.Unknown({ reason }),
    });

    const cleanupGetLegacyAccounts = container.handleGetLegacyAccounts((_, { ok }) =>
      rateLimiterGetLegacyAccounts.schedule(() => ok([])),
    );

    const cleanupAccountGet = container.handleAccountGet((productAccountId, { ok, err }) => {
      return rateLimiterProductAccounts.schedule(() => {
        const session = sessionRef();
        if (!session) {
          return err(new RequestCredentialsErr.NotConnected(undefined));
        }

        const [dotNsIdentifier, derivationIndex] = productAccountService.normalizeProductAccountId(productAccountId);

        if (!dotNsService.isProductIdentifier(dotNsIdentifier)) {
          return err(new RequestCredentialsErr.DomainNotValid(undefined));
        }

        const publicKey = productAccountService.deriveProductPublicKey(session.rootAccountId, dotNsIdentifier, derivationIndex);

        return ok({ publicKey });
      });
    });

    const userIdentityRequest: RemotePermissionRequest = { tag: 'UserIdentity' };
    const userIdentityStatusBridge = createPermissionStatusBridge();

    const getUserIdentityStatus = () => {
      return userIdentityStatusBridge.getStatus('UserIdentity', () =>
        permissionsService.getRemotePermissionRequestStatus(productPermissionsRef(), userIdentityRequest, modality),
      );
    };

    const persistUserIdentityPermission = (status: Parameters<typeof permissionsService.buildRemotePermissionsToStore>[1]) =>
      firstValueFrom(
        setRemotePermissionsBatchRef().run({
          productId: identifier,
          permissions: permissionsService.buildRemotePermissionsToStore(userIdentityRequest, status, modality),
        }),
      ).then(() => {
        userIdentityStatusBridge.setOverride('UserIdentity', status);
      });

    const clearGetUserId = container.handleGetUserId((_, { ok, err }) =>
      rateLimiterGetIdentityAccount.schedule(() => {
        const account = sessionRef();
        if (!account) {
          return err(new GetUserIdErr.NotConnected());
        }
        const identity = identityRef();
        const primaryUsername = identity?.fullUsername ?? identity?.liteUsername;
        if (!primaryUsername) {
          return err(new GetUserIdErr.NotConnected());
        }

        const status = getUserIdentityStatus();
        if (status === 'granted') {
          return ok({ primaryUsername });
        }

        if (status === 'denied') {
          return err(new GetUserIdErr.PermissionDenied());
        }

        return fromPromise(
          confirm<PermissionDecision>(`${identifier}-userIdentityPermission`, ({ resolve }) => (
            <RemotePermissionRequestDialog
              isOpen
              productId={identifier}
              permission="UserIdentity"
              values={null}
              onAllowAlways={() => resolve('allow-always')}
              onAllowOnce={() => resolve('allow-once')}
              onDeny={() => resolve('deny')}
              onDismiss={() => resolve('dismiss')}
            />
          )),
          () => new GetUserIdErr.PermissionDenied(),
        ).andThen(decision => {
          if (decision === 'dismiss') {
            return err(new GetUserIdErr.PermissionDenied());
          }

          const persistedStatus = getPersistedPermissionStatus(decision);
          if (!persistedStatus) {
            return err(new GetUserIdErr.PermissionDenied());
          }

          return fromPromise(
            persistUserIdentityPermission(persistedStatus),
            error => new GetUserIdErr.Unknown({ reason: toError(error).message }),
          ).andThen(() => {
            if (decision === 'deny') {
              return err(new GetUserIdErr.PermissionDenied());
            }

            return ok({ primaryUsername });
          });
        });
      }),
    );

    const cleanupConnectionStatus = container.handleAccountConnectionStatusSubscribe((_, send) => {
      const session = sessionRef();
      send(session ? 'connected' : 'disconnected');

      return subscribeSession(session => send(session ? 'connected' : 'disconnected'));
    });

    const cleanupGetAlias = container.handleAccountGetAlias((rawProductAccountId, { err }) =>
      rateLimiterGetAlias.schedule(() => {
        const session = sessionRef();
        if (!session) {
          return err(new RequestCredentialsErr.NotConnected(undefined));
        }

        const productAccountId = productAccountService.normalizeProductAccountId(rawProductAccountId);

        if (!dotNsService.isProductIdentifier(productAccountId[0])) {
          return err(new RequestCredentialsErr.DomainNotValid(undefined));
        }

        // Even when the product asks for an alias of its own domain, the
        // request goes through the remote signer (bulletin paseo round-trip,
        // protected by the user's identity key). Skipping the permission
        // modal for "own domain" let products kick off an automatic VRF
        // request on startup, which monopolised the host-papp request queue
        // for up to 180s and blocked any user-initiated signing behind it.
        // Always require explicit user approval.
        const runAliasRequest = () =>
          session.getRingVrfAlias(productAccountId, identifier).mapErr(error => {
            console.error('[vrf-alias] host-side error', error);
            return new RequestCredentialsErr.Unknown({ reason: error.message });
          });

        const requestedIdentifier = productAccountId[0];
        const currentStatus = aliasPermissionService.getStatus(aliasPermissionsRef(), identifier, requestedIdentifier);

        if (currentStatus === 'granted') {
          return runAliasRequest();
        }

        if (currentStatus === 'denied') {
          return err(new RequestCredentialsErr.Rejected());
        }

        return fromPromise(
          confirm<AliasPermissionDecision>('ringVrfAlias', ({ resolve }) => (
            <AliasPermissionModal
              product={productRef()}
              requestedIdentifier={requestedIdentifier}
              onAllowAlways={() => resolve('allow-always')}
              onAllowOnce={() => resolve('allow-once')}
              onDeny={() => resolve('deny')}
              onDismiss={() => resolve('dismiss')}
            />
          )),
          () => new RequestCredentialsErr.Rejected(),
        ).andThen(decision => {
          const effect = decideAliasPermissionEffect(decision);

          if (effect === 'allow-once') {
            return runAliasRequest();
          }

          if (effect === 'persist-granted') {
            void setAliasPermissionRef().run({
              requesterProductId: identifier,
              requestedContextId: requestedIdentifier,
              status: 'granted',
            });
            return runAliasRequest();
          }

          if (effect === 'persist-denied') {
            void setAliasPermissionRef().run({
              requesterProductId: identifier,
              requestedContextId: requestedIdentifier,
              status: 'denied',
            });
          }

          return err(new RequestCredentialsErr.Rejected());
        });
      }),
    );

    const cleanupRequestResourceAllocation = container.handleRequestResourceAllocation((resources, { ok, err }) => {
      const session = sessionRef();
      if (!session) {
        return err(new ResourceAllocationErr.Unknown({ reason: 'No active session' }));
      }

      const queued = ResultAsync.fromPromise(
        pappSsoQueue.call(
          () =>
            confirm<CodecType<typeof AllocationOutcome>[]>('requestResourceAllocation', ({ resolve, reject }) => (
              <AllocationRequestModal
                productIdentifier={identifier}
                resources={resources}
                session={session}
                onResult={resolve}
                onReject={reject}
              />
            )),
          { signal: abortController.signal },
        ),
        e => new ResourceAllocationErr.Unknown({ reason: toError(e).message }),
      );

      return queued.andThen(outcomes => ok(outcomes));
    });

    return () => {
      cleanupGetLegacyAccounts();
      cleanupAccountGet();
      cleanupConnectionStatus();
      cleanupGetAlias();
      cleanupRequestResourceAllocation();
      clearGetUserId();
      rateLimiterGetLegacyAccounts.destroy();
      rateLimiterGetIdentityAccount.destroy();
      rateLimiterProductAccounts.destroy();
      rateLimiterGetAlias.destroy();
      abortController.abort();
    };
    // `identifier` and `modality` are captured by the UserIdentity status read /
    // persist closures above (getUserIdentityStatus, persistUserIdentityPermission).
    // The container is not recreated when only the binding's modality changes, so
    // this effect must re-register to keep the modality bucket correct — matching
    // the sibling usePermissions effect's dependency list.
  }, [container, identifier, modality]);
}
