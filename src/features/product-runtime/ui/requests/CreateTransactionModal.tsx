import { type CreateTransactionReview } from '@parity/truapi-host';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { useDecodedCall } from '@/domains/network';
import { useProductAccountAddress } from '@/aggregates/truapi-runtime';
import { useChainName } from '../../hooks/useChainName';
import { productRuntimeService } from '../../service';
import {
  RequestAccountDetailsSection,
  RequestDetailSection,
  RequestHint,
  RequestMonoLine,
  RequestSummaryNote,
  RequestSummaryRow,
  TxArgumentsJson,
} from '../productRequestParts';

import { ReviewRequestLayout } from './ReviewRequestLayout';

type Props = {
  review: CreateTransactionReview;
  onDecide: (approved: boolean) => void;
};

/**
 * The richest review: a transaction the product wants signed and submitted.
 *
 * The summary answers "what call, on which chain, from which account"; the details pane
 * carries the decoded arguments and the raw call data, both copyable. A chain whose
 * metadata the host cannot read degrades to the call-data block with a warning rather
 * than to a claim it cannot support.
 */
export const CreateTransactionModal = ({ review, onDecide }: Props) => {
  const { t } = useTranslation();
  const { payload } = review.value;
  const { data: decoded } = useDecodedCall({ genesisHash: payload.genesisHash, callData: payload.callData });
  const chainName = useChainName(payload.genesisHash);

  const call = decoded ? productRuntimeService.formatCallTitle(decoded.pallet, decoded.method) : null;
  const batchHint = decoded ? productRuntimeService.batchBehaviorKey(decoded.pallet, decoded.method) : null;
  const productAccount = review.tag === 'Product' ? review.value.payload.signer : null;
  const legacyAccount = review.tag === 'LegacyAccount' ? productRuntimeService.legacySignerAccount(review.value.account) : null;
  const signer =
    review.tag === 'LegacyAccount'
      ? legacyAccount
        ? productRuntimeService.formatProductAccount(legacyAccount)
        : review.value.payload.signer
      : productRuntimeService.formatProductAccount(review.value.payload.signer);

  const { address: derivedAddress, pending: addressPending } = useProductAccountAddress(productAccount);
  const address = review.tag === 'LegacyAccount' ? review.value.payload.signer : derivedAddress;
  const addressFailed = productAccount !== null && !addressPending && derivedAddress === null;

  return (
    <ReviewRequestLayout
      identifier={(productAccount ?? legacyAccount)?.dotNsIdentifier ?? null}
      title={call ? t('feature.browser.signingRequestTitle', { call }) : t('feature.browser.signTransaction')}
      primaryLabel={t('feature.browser.continueToSign')}
      primaryTestId={TEST_IDS.signReviewContinueButton}
      summary={
        <>
          {decoded ? null : (
            <RequestSummaryNote tone="warning" testId={TEST_IDS.signReviewCustomChainWarning}>
              {t('feature.browser.customChainSigningWarning')}
            </RequestSummaryNote>
          )}
          {batchHint ? (
            <RequestSummaryNote tone="info" testId={TEST_IDS.signReviewBatchHint}>
              {t(batchHint)}
            </RequestSummaryNote>
          ) : null}
          <RequestSummaryRow label={t('feature.browser.account')} value={signer} testId={TEST_IDS.signReviewAccount} />
          <RequestSummaryRow
            label={t('feature.browser.network')}
            value={chainName ?? payload.genesisHash}
            testId={TEST_IDS.signReviewNetwork}
          />
          {/*
            The network fee needs the signer's address to call `getPaymentInfo`, and the host
            cannot derive one until the core persists the product subtree key. Omitted rather
            than shown as a guess.
            TODO(truapi): restore the fee row once the core persists the product subtree key —
            see docs/_plans/truapi-upstream-issues.md.
          */}
        </>
      }
      details={
        <>
          <RequestAccountDetailsSection label={t('feature.browser.account')} address={address} failed={addressFailed} />
          <RequestDetailSection
            label={t('common.label.arguments')}
            copyValue={productRuntimeService.stringifyCallArguments(decoded?.args)}
            copyLabel={t('feature.browser.copyArguments')}
            testId={TEST_IDS.signReviewArguments}
          >
            <TxArgumentsJson value={decoded?.args} />
          </RequestDetailSection>
          <RequestDetailSection
            label={t('common.label.callData')}
            copyValue={payload.callData}
            copyLabel={t('feature.browser.copyCallData')}
            testId={TEST_IDS.signReviewCallData}
          >
            <RequestMonoLine>{payload.callData}</RequestMonoLine>
          </RequestDetailSection>
        </>
      }
      hint={<RequestHint>{t('feature.browser.polkadotAppHint')}</RequestHint>}
      onApprove={() => onDecide(true)}
      onDeny={() => onDecide(false)}
    />
  );
};
