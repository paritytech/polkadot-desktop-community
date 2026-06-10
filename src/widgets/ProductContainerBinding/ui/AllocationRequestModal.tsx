import { type AllocatableResource, type AllocationOutcome, type CodecType } from '@novasamatech/host-api';
import { type UserSession } from '@novasamatech/host-papp';
import { Button, Copy, Dialog } from '@novasamatech/tr-ui';
import { toHex } from '@polkadot-api/utils';
import { ChevronLeft, Copy as CopyIcon } from 'lucide-react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import * as v from 'valibot';

import { useTranslation } from '@/shared/translation';
import { accountId, accountService } from '@/domains/network';
import { productAccountService, useDisplayedProduct } from '@/domains/product';
import { SIGNING_TIMEOUT_MS, withSigningTimeout } from '../withSigningTimeout';

import { SignPolkadotAppModal } from './SignPolkadotAppModal';
import {
  SigningProductHeader,
  SigningReviewFooter,
  getProductPresentation,
  signingDetailCodeBlockClassName,
  signingDialogCornerControlClassName,
  signingDialogHeadingClassName,
  signingRawMessageCardClassName,
} from './signingModalParts';

type AllocatableResourceValue = CodecType<typeof AllocatableResource>;
type AllocationOutcomeValue = CodecType<typeof AllocationOutcome>;
type SmartContractResource = Extract<AllocatableResourceValue, { tag: 'SmartContractAllowance' }>;
// host-papp 0.7.9 still speaks the v0.7 wire shape for resource allocation.
type PappAllocatableResource = Parameters<UserSession['requestResourceAllocation']>[0]['resources'][number];

type SmartContractAccountDetail = {
  index: number;
  address: string;
};

type Props = {
  productIdentifier: string;
  resources: AllocatableResourceValue[];
  session: UserSession;
  onResult: (outcomes: AllocationOutcomeValue[]) => void;
  onReject: VoidFunction;
};

const isSmartContractResource = (resource: AllocatableResourceValue): resource is SmartContractResource =>
  resource.tag === 'SmartContractAllowance';

export const AllocationRequestModal = memo(({ productIdentifier, resources, session, onResult, onReject }: Props) => {
  const { t } = useTranslation();
  const grantStartedRef = useRef(false);
  const [step, setStep] = useState<'review' | 'polkadotApp'>('review');
  const [error, setError] = useState<string | null>(null);
  const [showSmartContractDetails, setShowSmartContractDetails] = useState(false);

  const { data: product } = useDisplayedProduct(productIdentifier);
  const productName = product?.displayName ?? getProductPresentation(productIdentifier).name;

  const smartContractResources = useMemo(() => resources.filter(isSmartContractResource), [resources]);
  const otherResources = useMemo(() => resources.filter(resource => !isSmartContractResource(resource)), [resources]);

  const smartContractAccounts = useMemo((): SmartContractAccountDetail[] => {
    return smartContractResources.map(resource => {
      const publicKey = productAccountService.deriveProductPublicKey(session.rootAccountId, productIdentifier, resource.value);
      const address = accountService.toAddress(v.parse(accountId, toHex(publicKey))).value;

      return { index: resource.value, address };
    });
  }, [productIdentifier, session.rootAccountId, smartContractResources]);

  const hasSmartContractDetails = smartContractAccounts.length > 0;

  const renderOtherResourceLabel = (resource: AllocatableResourceValue) => {
    switch (resource.tag) {
      case 'StatementStoreAllowance':
        return t('widget.productContainerBinding.allocationRequest.resource.StatementStoreAllowance');
      case 'BulletinAllowance':
        return t('widget.productContainerBinding.allocationRequest.resource.BulletinAllowance');
      case 'AutoSigning':
        return t('widget.productContainerBinding.allocationRequest.resource.AutoSigning');
      case 'SmartContractAllowance':
        return t('widget.productContainerBinding.allocationRequest.resource.SmartContractAllowance');
    }
  };

  const requestAllocation = useCallback(() => {
    // host-api 0.8 renamed the resource tag BulletInAllowance → BulletinAllowance, but host-papp
    // (still 0.7.9) decodes against the old tag. Remap at the cross-version boundary.
    const pappResources: PappAllocatableResource[] = resources.map(resource =>
      resource.tag === 'BulletinAllowance' ? { tag: 'BulletInAllowance', value: undefined } : resource,
    );

    withSigningTimeout(
      session.requestResourceAllocation({
        callingProductId: productIdentifier,
        resources: pappResources,
        onExisting: 'Increase',
      }),
    ).match(
      outcomes => {
        const mapped: AllocationOutcomeValue[] = outcomes.map(outcome =>
          outcome.tag === 'Allocated' ? { tag: 'Allocated', value: undefined } : outcome,
        );
        onResult(mapped);
      },
      e => {
        grantStartedRef.current = false;
        setStep('review');
        setError(e.message);
      },
    );
  }, [onResult, productIdentifier, resources, session]);

  const handleApprove = () => {
    if (grantStartedRef.current) {
      return;
    }
    grantStartedRef.current = true;
    setError(null);
    setStep('polkadotApp');
    requestAllocation();
  };

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && step === 'review' && !grantStartedRef.current) {
        onReject();
      }
    },
    [onReject, step],
  );

  const handleInteractOutside = (event: { preventDefault: () => void }) => {
    event.preventDefault();
  };

  const handleShowSmartContractDetails = () => {
    setShowSmartContractDetails(true);
  };

  const handleHideSmartContractDetails = () => {
    setShowSmartContractDetails(false);
  };

  if (step === 'polkadotApp') {
    return (
      <SignPolkadotAppModal mode="allocation" open lifetimeMs={SIGNING_TIMEOUT_MS} onCancel={onReject} onTimeout={onReject} />
    );
  }

  return (
    <Dialog modal open onOpenChange={handleOpenChange}>
      <Dialog.Content
        aria-describedby={undefined}
        showCloseButton
        variant="tall"
        onOpenAutoFocus={event => event.preventDefault()}
        onInteractOutside={handleInteractOutside}
      >
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-6">
          {!showSmartContractDetails ? <SigningProductHeader identifier={productIdentifier} /> : null}

          {!showSmartContractDetails ? (
            <div className="pt-2">
              <Dialog.Title asChild>
                <h2 className={signingDialogHeadingClassName}>{t('widget.productContainerBinding.allocationRequest.title')}</h2>
              </Dialog.Title>
              <p className="mt-2 text-base leading-6 text-text-primary">
                {t('widget.productContainerBinding.allocationRequest.description', { productName })}
              </p>
            </div>
          ) : (
            <button
              type="button"
              className={`${signingDialogCornerControlClassName} left-[11px] w-auto max-w-[calc(100%-4rem)] gap-1 px-2`}
              aria-label={t('common.action.back')}
              onClick={handleHideSmartContractDetails}
            >
              <ChevronLeft className="size-5 shrink-0" />
              <span className="text-base leading-6">{t('common.action.back')}</span>
            </button>
          )}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {!showSmartContractDetails ? (
              <>
                <div className={signingRawMessageCardClassName}>
                  <p className="text-base leading-6 text-text-secondary">
                    {t('widget.productContainerBinding.allocationRequest.requestedResources')}
                  </p>
                  <ul className="flex flex-col gap-2 pl-6 text-base leading-6 text-text-primary [&>li]:list-disc">
                    {otherResources.map((resource, index) => (
                      // eslint-disable-next-line react/no-array-index-key -- list is static for the modal's lifetime
                      <li key={`${resource.tag}-${index}`}>{renderOtherResourceLabel(resource)}</li>
                    ))}
                    {hasSmartContractDetails ? (
                      <li>{t('widget.productContainerBinding.allocationRequest.resource.SmartContractAllowance')}</li>
                    ) : null}
                  </ul>
                  {hasSmartContractDetails ? (
                    <Button
                      type="button"
                      variant="secondary"
                      fullWidth
                      aria-expanded={showSmartContractDetails}
                      onClick={handleShowSmartContractDetails}
                    >
                      {t('common.action.moreDetails')}
                    </Button>
                  ) : null}
                </div>

                <div className="mt-auto flex w-full shrink-0 justify-center pt-4">
                  <p className="text-center text-sm leading-5 text-text-secondary">
                    {t('widget.productContainerBinding.allocationRequest.polkadotAppHint')}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-8 overflow-y-auto pt-14 pr-1">
                <p className="text-base leading-6 text-text-primary">
                  {t('widget.productContainerBinding.allocationRequest.smartContractDetailsIntro')}
                </p>
                {smartContractAccounts.map(account => (
                  <section key={account.index} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-base leading-6 text-text-secondary">
                        {t('widget.productContainerBinding.allocationRequest.appAccountWithIndex', {
                          index: account.index,
                        })}
                      </span>
                      <Copy value={account.address}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t('widget.productContainerBinding.allocationRequest.copyAccountAddress')}
                        >
                          <CopyIcon className="size-4" />
                        </Button>
                      </Copy>
                    </div>
                    <div className={signingDetailCodeBlockClassName}>
                      <div className="font-mono text-sm leading-5 break-all text-text-primary">{account.address}</div>
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          {error ? <p className="text-sm text-fg-error">{error}</p> : null}

          {!showSmartContractDetails ? (
            <SigningReviewFooter
              cancelLabel={t('common.action.cancel')}
              pending={false}
              primaryDisabled={false}
              primaryLabel={t('widget.productContainerBinding.allocationRequest.grantAccess')}
              primaryPendingLabel={t('widget.productContainerBinding.allocationRequest.pending')}
              onPrimary={handleApprove}
            />
          ) : null}
        </div>
      </Dialog.Content>
    </Dialog>
  );
});

AllocationRequestModal.displayName = 'AllocationRequestModal';
