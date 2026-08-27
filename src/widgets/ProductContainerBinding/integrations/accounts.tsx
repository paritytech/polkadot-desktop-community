import {
  type AllocationOutcome,
  type CodecType,
  type VrfSignature,
  CreateProofErr,
  GetAliasErr,
  GetUserIdErr,
  ListRingVrfKeysErr,
  RegisterRingVrfKeyErr,
  RequestCredentialsErr,
  ResourceAllocationErr,
  RingVrfSignErr,
  SignVrfErr,
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
  type AliasPermissionStatus,
  type PermissionModality,
  type RemotePermissionRequest,
  aliasPermissionService,
  allowanceUseCase,
  permissionsService,
  productAccountService,
  productAccountUseCase,
  useAllAliasPermissions,
  useDisplayedProduct,
  useIsProductIdentifier,
  useProductPermissions,
  useSetAliasPermission,
  useSetRemotePermissionsBatch,
} from '@/domains/product';
import { RemotePermissionRequestDialog } from '@/widgets/Permission';
import { AliasPermissionModal } from '../ui/AliasPermissionModal';
import { AllocationRequestModal } from '../ui/AllocationRequestModal';
import { KeyListingPermissionModal } from '../ui/KeyListingPermissionModal';
import { ProofPermissionModal } from '../ui/ProofPermissionModal';
import { SignVrfModal } from '../ui/SignVrfModal';

import { createOnRateLimited, createSubscriptionScope, pappSsoQueue } from './_helpers';
import { isReservedAccountHolder, tryCanonicalizeSelfAlias } from './accountCompatibility';
import { type AliasPermissionDecision, decideAliasPermissionEffect } from './aliasPermissionDecision';
import { buildAllocatedOutcomes, mapResourcesToAllowanceKinds } from './allocationPrecheck';
import { type PermissionDecision, getPersistedPermissionStatus } from './permissionDecision';
import { createPermissionStatusBridge } from './permissionStatusBridge';
import { useEnsureProductSubtree } from './productSubtree';
import {
  mapAliasWireError,
  mapListRingVrfKeysWireError,
  mapProofWireError,
  mapRegisterRingVrfKeyWireError,
  mapRingVrfSignWireError,
} from './ringVrfError';
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
  // Through a ref because the handlers below are registered once. The check
  // itself is settled-gated (`useIsProductIdentifier`): under the TLD fallback it
  // would reject this network's names and admit another network's.
  const isProductIdentifierRef = useLooseRef(useIsProductIdentifier());
  const ensureProductSubtree = useEnsureProductSubtree();
  const ensureProductSubtreeRef = useLooseRef(ensureProductSubtree);
  const subscribeSession = useSubscription(session);

  const [identity] = useSessionIdentity(session);
  const identityRef = useLooseRef(identity);

  useEffect(() => {
    const abortController = new AbortController();
    const subscriptions = createSubscriptionScope();
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
      mapErr: reason => new GetAliasErr.Unknown({ reason }),
    });
    const rateLimiterCreateProof = createDefaultRateLimiter({
      onRateLimited: createOnRateLimited(identifier, getProductName, 'proof', tRef()),
      mapErr: reason => new CreateProofErr.Unknown({ reason }),
    });
    const rateLimiterSignVrf = createDefaultRateLimiter({
      onRateLimited: createOnRateLimited(identifier, getProductName, 'signVrf', tRef()),
      mapErr: reason => new SignVrfErr.Unknown({ reason }),
    });
    const rateLimiterRegisterRingVrfKey = createDefaultRateLimiter({
      onRateLimited: createOnRateLimited(identifier, getProductName, 'ringVrfRegister', tRef()),
      mapErr: reason => new RegisterRingVrfKeyErr.Unknown({ reason }),
    });
    const rateLimiterListRingVrfKeys = createDefaultRateLimiter({
      onRateLimited: createOnRateLimited(identifier, getProductName, 'ringVrfList', tRef()),
      mapErr: reason => new ListRingVrfKeysErr.Unknown({ reason }),
    });
    const rateLimiterRingVrfSign = createDefaultRateLimiter({
      onRateLimited: createOnRateLimited(identifier, getProductName, 'ringVrfSign', tRef()),
      mapErr: reason => new RingVrfSignErr.Unknown({ reason }),
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
        // Host Playground passes the canonical container identifier with a `.dot` suffix
        // (e.g. `host-playground.paseo.dot`). Normalise it back to the bare dotNS name
        // before validation and subtree lookup so the call resolves correctly.
        const canonicalIdentifier = tryCanonicalizeSelfAlias(dotNsIdentifier, identifier);

        if (!isProductIdentifierRef()(canonicalIdentifier)) {
          return err(new RequestCredentialsErr.DomainNotValid(undefined));
        }

        // RFC-0022: the key comes from the paired device, not local derivation. The gate
        // surfaces that round trip the first time it happens for this pairing; afterwards it
        // resolves from persistence with no UI.
        //
        // Composed, not awaited — `ResultAsync` is thenable, so `await` silently unwraps it
        // to a plain `Result` and breaks the handler contract. This callback must NOT become
        // `async` for the same reason.
        return fromPromise(ensureProductSubtreeRef()(session, canonicalIdentifier), toError)
          .andThen(() =>
            fromPromise(productAccountUseCase.getProductAccountPublicKey(session, canonicalIdentifier, derivationIndex), toError),
          )
          .andThen(publicKey => ok({ publicKey }))
          .orElse(error => {
            console.error('[ProductContainerBinding] product subtree lookup failed', error);

            return err(new RequestCredentialsErr.NotConnected(undefined));
          });
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

      return subscriptions.track(
        subscribeSession(session => {
          if (subscriptions.disposed) return;
          send(session ? 'connected' : 'disconnected');
        }),
      );
    });

    const cleanupGetAlias = container.handleAccountGetAlias(([keyHandle, context, ring], { err }) =>
      rateLimiterGetAlias.schedule(() => {
        const session = sessionRef();
        if (!session) {
          return err(new GetAliasErr.Unknown({ reason: 'No active session' }));
        }

        // Both are caller-supplied and reach the paired device and the consent dialog below,
        // where an unconstrained string would be a spoofing surface.
        if (
          (!isProductIdentifierRef()(context[0]) && !isReservedAccountHolder(context[0])) ||
          (!isProductIdentifierRef()(keyHandle[0]) && !isReservedAccountHolder(keyHandle[0]))
        ) {
          return err(new GetAliasErr.Unknown({ reason: 'Invalid product identifier' }));
        }

        const runAliasRequest = () =>
          session.getRingVrfAlias(identifier, keyHandle, context, ring).mapErr(error => {
            console.error('[vrf-alias] host-side error', error);
            return mapAliasWireError(error);
          });

        const isOwnKey = productAccountService.isOwnedBy(keyHandle[0], identifier);

        // RFC-0024: asking for an alias of your own context with your own key is
        // permissionless — the prompt would be asking the user to approve a product's
        // access to itself.
        //
        // This reverses the earlier always-ask policy, which existed because skipping the
        // modal for "own domain" let products fire an alias request on startup that
        // monopolised the host-papp request queue for up to 180s and blocked user-initiated
        // signing behind it. `rateLimiterGetAlias` bounds the request *rate*, not the queue
        // occupancy that caused it — see the note in the RFC-0024 review.
        if (isOwnKey && productAccountService.isOwnedBy(context[0], identifier)) {
          return runAliasRequest();
        }

        const requestedIdentifier = context[0];
        const currentStatus = aliasPermissionService.getStatus(aliasPermissionsRef(), identifier, requestedIdentifier);

        if (currentStatus === 'denied') {
          return err(new GetAliasErr.Rejected());
        }

        // A stored grant records the context alone, so it can only stand in for consent when the
        // key is the caller's own — the key owner the user approved is not part of the entry.
        // A foreign key therefore always asks, and never writes: persisting would either speak
        // for key owners the user never saw or clobber a grant an own-key run made.
        if (currentStatus === 'granted' && isOwnKey) {
          return runAliasRequest();
        }

        const persistAliasPermission = (status: AliasPermissionStatus) => {
          if (!isOwnKey) return;

          void setAliasPermissionRef().run({
            requesterProductId: identifier,
            requestedContextId: requestedIdentifier,
            status,
          });
        };

        return fromPromise(
          confirm<AliasPermissionDecision>('ringVrfAlias', ({ resolve }) => (
            <AliasPermissionModal
              product={productRef()}
              requestedIdentifier={requestedIdentifier}
              foreignKeyOwner={isOwnKey ? null : keyHandle[0]}
              onAllowAlways={() => resolve('allow-always')}
              onAllowOnce={() => resolve('allow-once')}
              onDeny={() => resolve('deny')}
              onDismiss={() => resolve('dismiss')}
            />
          )),
          () => new GetAliasErr.Rejected(),
        ).andThen(decision => {
          const effect = decideAliasPermissionEffect(decision);

          if (effect === 'persist-ask') {
            persistAliasPermission('ask');
            return runAliasRequest();
          }

          if (effect === 'persist-granted') {
            persistAliasPermission('granted');
            return runAliasRequest();
          }

          if (effect === 'persist-denied') {
            persistAliasPermission('denied');
          }

          return err(new GetAliasErr.Rejected());
        });
      }),
    );

    const cleanupCreateProof = container.handleAccountCreateProof(([keyHandle, context, ring, message], { err }) =>
      rateLimiterCreateProof.schedule(() => {
        const session = sessionRef();
        if (!session) {
          return err(new CreateProofErr.Unknown({ reason: 'No active session' }));
        }

        if (!isProductIdentifierRef()(context[0]) && !isReservedAccountHolder(context[0])) {
          return err(new CreateProofErr.Unknown({ reason: 'Invalid product identifier' }));
        }

        // RFC-0024: proving with another product's key is admitted only when that product
        // has allowlisted the caller in its manifest. There is no manifest allowlist yet,
        // and a prompt must not stand in for one — a proof is a bearer token for its
        // context's alias and the message is opaque, so consenting to it is not meaningful
        // consent, and only the key's owner can weigh the risk.
        if (!productAccountService.isOwnedBy(keyHandle[0], identifier) && !isReservedAccountHolder(keyHandle[0])) {
          return err(new CreateProofErr.NotAllowlisted());
        }

        const runProofRequest = () =>
          session.createRingVrfProof(identifier, keyHandle, context, ring, message).mapErr(error => {
            console.error('[vrf-proof] host-side error', error);
            return mapProofWireError(error);
          });

        // A proof over a message is a signing-like action → always ask, no persistence.
        return fromPromise(
          confirm<boolean>('ringVrfProof', ({ resolve }) => (
            <ProofPermissionModal
              product={productRef()}
              requestedIdentifier={context[0]}
              onAllow={() => resolve(true)}
              onDeny={() => resolve(false)}
              onDismiss={() => resolve(false)}
            />
          )),
          () => new CreateProofErr.Rejected(),
        ).andThen(allowed => (allowed ? runProofRequest() : err(new CreateProofErr.Rejected())));
      }),
    );

    // Permissionless by RFC-0024: ownership is the calling product id and never a parameter,
    // so a product can only ever register keys in its own ring VRF domain. The paired device
    // is the authoritative registry, so this is a pure forward — desktop keeps no mirror.
    const cleanupRegisterRingVrfKey = container.handleAccountRegisterRingVrfKey(([index, ring], { err }) =>
      rateLimiterRegisterRingVrfKey.schedule(() => {
        const session = sessionRef();
        if (!session) {
          return err(new RegisterRingVrfKeyErr.NotConnected());
        }

        return session.registerRingVrfKey(identifier, index, ring).mapErr(error => {
          console.error('[vrf-register] host-side error', error);

          return mapRegisterRingVrfKeyWireError(error);
        });
      }),
    );

    const cleanupListRingVrfKeys = container.handleAccountListRingVrfKeys(([owner, disclosure], { err }) =>
      rateLimiterListRingVrfKeys.schedule(() => {
        const session = sessionRef();
        if (!session) {
          return err(new ListRingVrfKeysErr.NotConnected());
        }

        // `owner` is caller-supplied and reaches both the paired device and the consent
        // dialog below, where an unconstrained string would be a spoofing surface.
        if (!isProductIdentifierRef()(owner) && !isReservedAccountHolder(owner)) {
          return err(new ListRingVrfKeysErr.Unknown({ reason: 'Invalid product identifier' }));
        }

        const runListRequest = () =>
          session.listRingVrfKeys(identifier, owner, disclosure).mapErr(error => {
            console.error('[vrf-list] host-side error', error);

            return mapListRingVrfKeysWireError(error);
          });

        if (productAccountService.isOwnedBy(owner, identifier) || isReservedAccountHolder(owner)) {
          return runListRequest();
        }

        // Listing another product's registry is a read that authorises nothing, so it stays
        // on the ordinary prompt path rather than the allowlist-only one. Not persisted: the
        // prompt is the interim stand-in for the manifest allowlist and goes away with it.
        return fromPromise(
          confirm<boolean>('ringVrfKeyListing', ({ resolve }) => (
            <KeyListingPermissionModal
              product={productRef()}
              requestedIdentifier={owner}
              onAllow={() => resolve(true)}
              onDeny={() => resolve(false)}
              onDismiss={() => resolve(false)}
            />
          )),
          () => new ListRingVrfKeysErr.Rejected(),
        ).andThen(allowed => (allowed ? runListRequest() : err(new ListRingVrfKeysErr.Rejected())));
      }),
    );

    const cleanupRingVrfSign = container.handleAccountRingVrfSign(([keyHandle, message], { err }) =>
      rateLimiterRingVrfSign.schedule(() => {
        const session = sessionRef();
        if (!session) {
          return err(new RingVrfSignErr.NotConnected());
        }

        // Same allowlist-only rule as createProof, and for a wider reason: a signature is a
        // bearer token for the member key itself, with no ring or context to scope what it
        // authorises, and it is linkable to every other use of that key.
        if (!productAccountService.isOwnedBy(keyHandle[0], identifier)) {
          return err(new RingVrfSignErr.NotAllowlisted());
        }

        return session.ringVrfSign(identifier, keyHandle, message).mapErr(error => {
          console.error('[vrf-sign] host-side error', error);

          return mapRingVrfSignWireError(error);
        });
      }),
    );

    const cleanupSignVrf = container.handleAccountSignVrf(({ account, transcriptLabel, items }, { ok, err }) =>
      rateLimiterSignVrf.schedule(() => {
        const session = sessionRef();
        if (!session) {
          return err(new SignVrfErr.NotConnected());
        }

        const productAccountId = productAccountService.normalizeProductAccountId(account);
        if (!isProductIdentifierRef()(productAccountId[0])) {
          return err(new SignVrfErr.Unknown({ reason: 'Invalid product identifier' }));
        }

        // Desktop holds no key, so the modal owns the round trip to the Account Holder and
        // the wait it puts on screen. Cross-product signing is allowed: an account outside
        // the caller's own product simply always prompts, never a silent sign.
        return ResultAsync.fromPromise(
          pappSsoQueue.call(
            () =>
              confirm<CodecType<typeof VrfSignature>>('signVrf', ({ resolve, reject }) => (
                <SignVrfModal
                  session={session}
                  productIdentifier={identifier}
                  productAccountId={productAccountId}
                  transcriptLabel={transcriptLabel}
                  items={items}
                  onResult={resolve}
                  onCancel={reject}
                />
              )),
            { signal: abortController.signal },
          ),
          error => (error instanceof SignVrfErr ? error : new SignVrfErr.Unknown({ reason: toError(error).message })),
        ).andThen(signature => ok(signature));
      }),
    );

    const cleanupRequestResourceAllocation = container.handleRequestResourceAllocation((resources, { ok, err }) => {
      const session = sessionRef();
      if (!session) {
        return err(new ResourceAllocationErr.Unknown({ reason: 'No active session' }));
      }

      // On-chain pre-check: only resource kinds with readable on-chain allowance state
      // qualify; any other kind in the request maps to [], which resolves "insufficient"
      // and forces the regular SSO flow.
      const precheck = allowanceUseCase.checkResourcesSufficiency({
        session,
        productId: identifier,
        kinds: mapResourcesToAllowanceKinds(resources),
      });

      return ResultAsync.fromSafePromise(precheck).andThen(sufficient => {
        if (sufficient) {
          return ok(buildAllocatedOutcomes(resources));
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
    });

    return () => {
      subscriptions.dispose();
      cleanupGetLegacyAccounts();
      cleanupAccountGet();
      cleanupConnectionStatus();
      cleanupGetAlias();
      cleanupCreateProof();
      cleanupRegisterRingVrfKey();
      cleanupListRingVrfKeys();
      cleanupRingVrfSign();
      cleanupSignVrf();
      cleanupRequestResourceAllocation();
      clearGetUserId();
      rateLimiterGetLegacyAccounts.destroy();
      rateLimiterGetIdentityAccount.destroy();
      rateLimiterProductAccounts.destroy();
      rateLimiterGetAlias.destroy();
      rateLimiterCreateProof.destroy();
      rateLimiterRegisterRingVrfKey.destroy();
      rateLimiterListRingVrfKeys.destroy();
      rateLimiterRingVrfSign.destroy();
      rateLimiterSignVrf.destroy();
      abortController.abort();
    };
    // `identifier` and `modality` are captured by the UserIdentity status read /
    // persist closures above (getUserIdentityStatus, persistUserIdentityPermission).
    // The container is not recreated when only the binding's modality changes, so
    // this effect must re-register to keep the modality bucket correct — matching
    // the sibling usePermissions effect's dependency list.
  }, [container, identifier, modality]);
}
