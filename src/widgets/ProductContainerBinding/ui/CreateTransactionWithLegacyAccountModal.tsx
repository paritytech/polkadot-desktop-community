import { type CodecType, type ProductAccountTransaction, CreateTransactionErr } from '@novasamatech/host-api';
import { type UserSession } from '@novasamatech/host-papp';
import { Button, Copy, Dialog, toastError } from '@novasamatech/tr-ui';
import { toHex } from '@polkadot-api/utils';
import { ChevronLeft, Copy as CopyIcon, Info } from 'lucide-react';
import { type Transaction } from 'polkadot-api';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as v from 'valibot';

import { useTranslation } from '@/shared/translation';
import { amountToString } from '@/shared/utils';
import { chainService, genesisHash, useAllChainsMap, useApi } from '@/domains/network';
import { type CreateTransactionResult } from '../types';
import { withSigningTimeout } from '../withSigningTimeout';

import { SignPolkadotAppModal } from './SignPolkadotAppModal';
import {
  SigningAccountDetailsSection,
  SigningPolkadotAppHint,
  SigningProductHeader,
  SigningReviewFooter,
  TxArgumentsJson,
  humanizeCallSegment,
  normalizeCallSegment,
  signingDetailCodeBlockClassName,
  signingDetailMonoSingleLineClassName,
  signingDialogCornerControlClassName,
  signingDialogHeadingClassName,
  signingSummarySectionClassName,
  stringifyTxArguments,
} from './signingModalParts';

type TransactionRequest = Omit<CodecType<typeof ProductAccountTransaction>, 'signer'>;

type Props = {
  session: UserSession;
  transaction: TransactionRequest;
  /** Legacy account that signs by its raw 32-byte AccountId; the address is shown verbatim. */
  account: { address: string; bytes: Uint8Array };
  productIdentifier: string;
  flowId?: string;
  onCancel: (error: unknown) => void;
  onResult: (result: CreateTransactionResult) => void;
};

export const CreateTransactionWithLegacyAccountModal = memo(
  ({ session, transaction, account, productIdentifier, flowId, onCancel, onResult }: Props) => {
    const tag = flowId ? `[Signing][${flowId}][CreateTransactionLegacy]` : '[Signing][CreateTransactionLegacy]';
    useEffect(() => {
      console.info(`${tag} modal mounted`);
      return () => console.info(`${tag} modal unmounted`);
    }, [tag]);
    const { t } = useTranslation();
    const address = account.address;
    const { data: chains } = useAllChainsMap();

    const genesisHashHex = toHex(transaction.genesisHash);
    const callDataHex = toHex(transaction.callData);

    const signStartedRef = useRef(false);
    const reviewRejectionToastShownRef = useRef(false);
    const [step, setStep] = useState<'review' | 'polkadotApp'>('review');
    const [pending, setPending] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [feeLoading, setFeeLoading] = useState(false);
    const [feePartial, setFeePartial] = useState<bigint | null>(null);

    const sign = () => {
      const startedAt = Date.now();
      console.info(`${tag} sign() started — calling session.createTransactionLegacy`, {
        address,
        genesisHash: genesisHashHex,
      });
      setPending(true);
      const signFlow = session.createTransactionLegacy({
        payload: {
          tag: 'v1',
          value: {
            signer: account.bytes,
            genesisHash: transaction.genesisHash,
            callData: transaction.callData,
            extensions: transaction.extensions,
            txExtVersion: transaction.txExtVersion,
          },
        },
      });
      withSigningTimeout(signFlow)
        .andTee(() => {
          console.info(`${tag} response received from remote signer in ${Date.now() - startedAt}ms`);
          setPending(false);
        })
        .orTee(error => {
          console.error(
            `${tag} createTransaction failed after ${Date.now() - startedAt}ms`,
            error instanceof Error ? error.message : error,
          );
          setPending(false);
        })
        .match(
          signedTransaction => {
            console.info(`${tag} calling onResult`);
            onResult({ signedTransaction });
          },
          e => {
            const reason = e instanceof Error ? e.message : String(e);
            console.warn(`${tag} calling onCancel — ${reason}`);
            onCancel(new CreateTransactionErr.Unknown({ reason }));
          },
        );
    };

    const parsedChainId = v.parse(genesisHash, genesisHashHex);
    const chain = chains[parsedChainId] ?? null;

    const canInspectSigning = chain !== null && chainService.canInspectSigning(chain);

    const { api } = useApi(canInspectSigning ? chain : null);

    const [tx, setTx] = useState<Transaction | null>(null);

    useEffect(() => {
      if (!api) return;
      let cancelled = false;
      api.api.txFromCallData(transaction.callData).then(next => {
        if (!cancelled) setTx(next);
      });
      return () => {
        cancelled = true;
      };
    }, [api, transaction.callData]);

    useEffect(() => {
      if (!tx) {
        setFeePartial(null);
        setFeeLoading(false);
        return;
      }

      let cancelled = false;
      setFeeLoading(true);
      tx.getPaymentInfo(address)
        .then(info => {
          if (!cancelled) {
            setFeePartial(info.partial_fee);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setFeePartial(null);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setFeeLoading(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [tx, address]);

    const nativeAsset = useMemo(() => {
      if (!canInspectSigning || !chain) return null;
      return chainService.getNativeAsset(chain.assets);
    }, [canInspectSigning, chain]);

    const callInfo = useMemo(() => {
      if (!tx) {
        return null;
      }
      return { section: tx.decodedCall.type, method: tx.decodedCall.value.type };
    }, [tx]);

    const titleCall = useMemo(() => {
      if (!callInfo) {
        return null;
      }

      const key = `${normalizeCallSegment(callInfo.section)}.${normalizeCallSegment(callInfo.method)}`;

      const localizedTitleMap: Record<string, string> = {
        'utility.batchall': t('feature.browser.operationTitle.utilityBatchAll'),
        'utility.batch': t('feature.browser.operationTitle.utilityBatch'),
        'utility.forcebatch': t('feature.browser.operationTitle.utilityForceBatch'),
      };

      const localizedTitle = localizedTitleMap[key];
      if (localizedTitle) {
        return localizedTitle;
      }

      const pallet = humanizeCallSegment(callInfo.section);
      const method = humanizeCallSegment(callInfo.method);
      return `${pallet} ${method}`.trim();
    }, [callInfo, t]);

    const batchBehaviorHint = useMemo(() => {
      if (!callInfo) {
        return null;
      }

      const key = `${normalizeCallSegment(callInfo.section)}.${normalizeCallSegment(callInfo.method)}`;

      switch (key) {
        case 'utility.batchall':
          return t('feature.browser.batchBehavior.revertOnError');
        case 'utility.batch':
          return t('feature.browser.batchBehavior.executeUntilError');
        case 'utility.forcebatch':
          return t('feature.browser.batchBehavior.ignoreErrors');
        default:
          return null;
      }
    }, [callInfo, t]);

    const requestTitle =
      titleCall !== null ? t('feature.browser.signingRequestTitle', { call: titleCall }) : t('feature.browser.signTransaction');

    const argumentsJson = useMemo(() => {
      if (!tx) {
        return '{}';
      }
      return stringifyTxArguments(tx.decodedCall.value.value);
    }, [tx]);

    const feeDisplay = useMemo(() => {
      if (feeLoading) {
        return '…';
      }
      if (feePartial === null || !nativeAsset) {
        return t('feature.browser.feeUnavailable');
      }
      const amount = amountToString(feePartial, nativeAsset.precision);
      return `${amount} ${nativeAsset.symbol}`;
    }, [feeLoading, feePartial, nativeAsset, t]);

    const dismissReviewWithRejectedToast = useCallback(() => {
      if (reviewRejectionToastShownRef.current) {
        return;
      }
      reviewRejectionToastShownRef.current = true;
      toastError({ title: t('feature.browser.transactionSigningRejected') });
      onCancel(new CreateTransactionErr.Rejected());
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
          onCancel={() => onCancel(new CreateTransactionErr.Rejected())}
          onTimeout={() => onCancel(new CreateTransactionErr.Rejected())}
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
                  <h2 className={signingDialogHeadingClassName}>{requestTitle}</h2>
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
                  <div className={signingSummarySectionClassName}>
                    {!canInspectSigning ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Info aria-hidden className="size-4 shrink-0 text-amber-500" />
                          <p className="text-sm leading-5 text-text-secondary">
                            {t('feature.browser.customChainSigningWarning')}
                          </p>
                        </div>
                        <div className="border-t border-general-border" role="separator" />
                      </>
                    ) : null}
                    {canInspectSigning && batchBehaviorHint ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Info aria-hidden className="size-4 shrink-0 text-text-secondary" />
                          <p className="text-sm leading-5 text-text-secondary">{batchBehaviorHint}</p>
                        </div>
                        <div className="border-t border-general-border" role="separator" />
                      </>
                    ) : null}
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-base leading-6 text-text-secondary">{t('feature.browser.account')}</span>
                      <span className="max-w-[65%] truncate font-mono text-base leading-6 text-text-primary">{address}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-base leading-6 text-text-secondary">{t('feature.browser.network')}</span>
                      <div className="flex max-w-[65%] min-w-0 items-center justify-end gap-2">
                        <span className="truncate text-right text-base leading-6 text-text-primary">
                          {chain?.name ?? genesisHashHex}
                        </span>
                      </div>
                    </div>
                    {canInspectSigning ? (
                      <div className="flex items-start justify-between gap-3 text-base leading-6 text-text-secondary">
                        <span>{t('feature.browser.networkFee')}</span>
                        <span className="text-right text-text-primary">{feeDisplay}</span>
                      </div>
                    ) : null}
                    <div className="mt-1 w-full">
                      <Button
                        type="button"
                        variant="secondary"
                        fullWidth
                        aria-expanded={showDetails}
                        onClick={handleToggleDetails}
                      >
                        {showDetails ? t('common.action.hideDetails') : t('common.action.moreDetails')}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-auto flex w-full shrink-0 justify-center pt-4">
                    <SigningPolkadotAppHint />
                  </div>
                </>
              ) : (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-8 overflow-y-auto pt-14 pr-1">
                  <SigningAccountDetailsSection label={t('feature.browser.accountAddress')} address={address} />
                  <section className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-base leading-6 text-text-secondary">{t('common.label.arguments')}</span>
                      <Copy value={argumentsJson}>
                        <Button type="button" variant="ghost" size="icon" aria-label={t('feature.browser.copyArguments')}>
                          <CopyIcon className="size-4" />
                        </Button>
                      </Copy>
                    </div>
                    <div className={signingDetailCodeBlockClassName}>
                      <TxArgumentsJson value={tx?.decodedCall.value.value} />
                    </div>
                  </section>
                  <section className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-base leading-6 text-text-secondary">{t('common.label.callData')}</span>
                      <Copy value={callDataHex}>
                        <Button type="button" variant="ghost" size="icon" aria-label={t('feature.browser.copyCallData')}>
                          <CopyIcon className="size-4" />
                        </Button>
                      </Copy>
                    </div>
                    <div className={signingDetailCodeBlockClassName}>
                      <div className={signingDetailMonoSingleLineClassName}>{callDataHex}</div>
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

CreateTransactionWithLegacyAccountModal.displayName = 'CreateTransactionWithLegacyAccountModal';
