import { SigningErr } from '@novasamatech/host-api';
import { type UserSession } from '@novasamatech/host-papp';
import { type SigningRawRequest } from '@novasamatech/host-papp';
import { Button, Copy, Dialog, toastError } from '@novasamatech/tr-ui';
import { toHex } from '@polkadot-api/utils';
import { ChevronLeft, Copy as CopyIcon, Info } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as v from 'valibot';

import { useTranslation } from '@/shared/translation';
import { type HexString } from '@/shared/types';
import { genesisHash, useAllChainsMap } from '@/domains/network';
import { type SigningResult } from '../types';
import { withSigningTimeout } from '../withSigningTimeout';

import { SignPolkadotAppModal } from './SignPolkadotAppModal';
import {
  SigningAccountDetailsSection,
  SigningPolkadotAppHint,
  SigningProductHeader,
  SigningReviewFooter,
  signingDetailCodeBlockClassName,
  signingDetailMonoSingleLineClassName,
  signingDialogCornerControlClassName,
  signingDialogHeadingClassName,
  signingRawMessageCardClassName,
} from './signingModalParts';

type Props = {
  session: UserSession;
  payload: SigningRawRequest['data'];
  /** Legacy account that signs by its raw 32-byte AccountId; the address is shown verbatim. */
  account: { address: string; bytes: Uint8Array };
  productIdentifier: string;
  /** Last genesis hash from product chain connection (raw requests omit chain in payload). */
  contextGenesisHash: HexString | null;
  flowId?: string;
  onCancel: (error: unknown) => void;
  onResult: (signResult: SigningResult) => void;
};

export const SignRawWithLegacyAccountModal = memo(
  ({ session, payload, account, productIdentifier, contextGenesisHash, flowId, onCancel, onResult }: Props) => {
    const tag = flowId ? `[Signing][${flowId}][SignRawLegacy]` : '[Signing][SignRawLegacy]';
    useEffect(() => {
      console.info(`${tag} modal mounted`);
      return () => console.info(`${tag} modal unmounted`);
    }, [tag]);
    const { t } = useTranslation();
    const address = account.address;
    const { data: chains } = useAllChainsMap();

    const signStartedRef = useRef(false);
    const reviewRejectionToastShownRef = useRef(false);
    const [step, setStep] = useState<'review' | 'polkadotApp'>('review');
    const [pending, setPending] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    const message = payload.tag === 'Payload' ? payload.value : toHex(payload.value);

    const parsedGenesis = useMemo(() => {
      if (!contextGenesisHash) {
        return null;
      }
      const parsed = v.safeParse(genesisHash, contextGenesisHash);
      return parsed.success ? parsed.output : null;
    }, [contextGenesisHash]);

    const chain = parsedGenesis ? chains[parsedGenesis] : undefined;

    const networkLabel = chain?.name ?? contextGenesisHash ?? null;
    const hasNetworkInfo = networkLabel !== null;

    const sign = () => {
      const startedAt = Date.now();
      console.info(`${tag} sign() started — calling session.signRawLegacy`, { address });
      setPending(true);
      const signFlow = session
        .signRawLegacy({ account: account.bytes, data: payload })
        .map(signature => ({ signature, signedTransaction: undefined }));
      withSigningTimeout(signFlow)
        .andTee(() => {
          console.info(`${tag} response received from remote signer in ${Date.now() - startedAt}ms`);
          setPending(false);
        })
        .orTee(error => {
          console.error(
            `${tag} signing failed after ${Date.now() - startedAt}ms`,
            error instanceof Error ? error.message : error,
          );
          setPending(false);
        })
        .match(
          ({ signature, signedTransaction }) => {
            console.info(`${tag} calling onResult`);
            onResult({
              id: 0,
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              signature: toHex(signature) as HexString,
              signedTransaction,
            });
          },
          e => {
            const reason = e instanceof Error ? e.message : String(e);
            console.warn(`${tag} calling onCancel — ${reason}`);
            onCancel(new SigningErr.Unknown({ reason }));
          },
        );
    };

    const dismissReviewWithRejectedToast = useCallback(() => {
      if (reviewRejectionToastShownRef.current) {
        return;
      }
      reviewRejectionToastShownRef.current = true;
      toastError({ title: t('feature.browser.transactionSigningRejected') });
      onCancel(new SigningErr.Rejected());
    }, [onCancel, t]);

    const handleOpenChange = (open: boolean) => {
      if (!open) {
        dismissReviewWithRejectedToast();
      }
    };

    const handleInteractOutside = (event: { preventDefault: () => void }) => {
      event.preventDefault();
    };

    const handleToggleDetails = () => {
      setShowDetails(v => !v);
    };

    const handleContinueToSign = () => {
      if (signStartedRef.current) {
        return;
      }
      signStartedRef.current = true;
      setStep('polkadotApp');
      sign();
    };

    if (step === 'polkadotApp') {
      return (
        <SignPolkadotAppModal
          open
          lifetimeMs={null}
          productIdentifier={productIdentifier}
          session={session}
          onCancel={() => onCancel(new SigningErr.Rejected())}
          onTimeout={() => onCancel(new SigningErr.Rejected())}
        />
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
            {!showDetails ? <SigningProductHeader identifier={productIdentifier} /> : null}

            {!showDetails ? (
              <div className="pt-2">
                <Dialog.Title asChild>
                  <h2 className={signingDialogHeadingClassName}>{t('feature.browser.signMessageRequestTitle')}</h2>
                </Dialog.Title>
              </div>
            ) : (
              <button
                type="button"
                className={`${signingDialogCornerControlClassName} left-2.75`}
                aria-label={t('common.action.back')}
                onClick={handleToggleDetails}
              >
                <ChevronLeft className="size-5" />
              </button>
            )}

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {!showDetails ? (
                <>
                  <div className={signingRawMessageCardClassName}>
                    <div className="flex gap-2">
                      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-text-secondary" />
                      <p className="text-sm leading-5 text-text-secondary">{t('feature.browser.rawMessageNotReadableCaption')}</p>
                    </div>
                    <div className="border-t border-general-border" role="separator" />
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-base leading-6 text-text-secondary">{t('feature.browser.account')}</span>
                      <span className="max-w-[65%] truncate font-mono text-base leading-6 text-text-primary">{address}</span>
                    </div>
                    {hasNetworkInfo ? (
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-base leading-6 text-text-secondary">{t('feature.browser.network')}</span>
                        <div className="flex max-w-[65%] min-w-0 items-center justify-end gap-2">
                          <span className="truncate text-right text-base leading-6 text-text-primary">{networkLabel}</span>
                        </div>
                      </div>
                    ) : null}
                    <div className="w-full">
                      <Button
                        type="button"
                        variant="secondary"
                        fullWidth
                        aria-expanded={showDetails}
                        onClick={handleToggleDetails}
                      >
                        {t('common.action.moreDetails')}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-auto flex w-full shrink-0 justify-center pt-4">
                    <SigningPolkadotAppHint variant="rawMessage" />
                  </div>
                </>
              ) : (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-8 overflow-y-auto pt-14 pr-1">
                  <SigningAccountDetailsSection label={t('feature.browser.accountAddress')} address={address} />
                  <section className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-base leading-6 text-text-secondary">{t('common.label.message')}</span>
                      <Copy value={message}>
                        <Button type="button" variant="ghost" size="icon" aria-label={t('feature.browser.copyMessage')}>
                          <CopyIcon className="size-4" />
                        </Button>
                      </Copy>
                    </div>
                    <div className={signingDetailCodeBlockClassName}>
                      <div className={signingDetailMonoSingleLineClassName}>{message}</div>
                    </div>
                  </section>
                </div>
              )}
            </div>

            {!showDetails ? (
              <SigningReviewFooter
                cancelLabel={t('common.action.cancel')}
                primaryLabel={t('feature.browser.continueToSign')}
                primaryPendingLabel={t('common.action.signing')}
                pending={pending}
                onPrimary={handleContinueToSign}
              />
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog>
    );
  },
);

SignRawWithLegacyAccountModal.displayName = 'SignRawWithLegacyAccountModal';
