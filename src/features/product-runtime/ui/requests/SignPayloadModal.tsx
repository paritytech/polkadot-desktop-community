import { type SignPayloadReview } from '@parity/truapi-host';

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
  RequestSummaryRow,
  TxArgumentsJson,
} from '../productRequestParts';

import { ReviewRequestLayout } from './ReviewRequestLayout';

type Props = {
  review: SignPayloadReview;
  onDecide: (approved: boolean) => void;
};

/**
 * An already-built extrinsic payload the product wants signed.
 *
 * Distinct from `CreateTransactionModal`: the payload arrives assembled, so what is on
 * offer is a signature, not a submission. Where the payload carries a call and a genesis
 * hash the call is decoded and named; otherwise the summary stays with the account.
 */
export const SignPayloadModal = ({ review, onDecide }: Props) => {
  const { t } = useTranslation();
  const { request } = review.value;
  const source = productRuntimeService.payloadCallSource(request.payload);
  const { data: decoded } = useDecodedCall(source);
  const chainName = useChainName(source.genesisHash);

  const call = decoded ? productRuntimeService.formatCallTitle(decoded.pallet, decoded.method) : null;
  const legacyAccount = review.tag === 'LegacyAccount' ? productRuntimeService.legacySignerAccount(review.value.account) : null;
  const signer =
    review.tag === 'LegacyAccount'
      ? legacyAccount
        ? productRuntimeService.formatProductAccount(legacyAccount)
        : review.value.request.signer
      : productRuntimeService.formatProductAccount(review.value.request.account);

  const productAccount = review.tag === 'Product' ? review.value.request.account : null;
  const { address: derivedAddress, pending: addressPending } = useProductAccountAddress(productAccount);
  const address = review.tag === 'LegacyAccount' ? review.value.request.signer : derivedAddress;
  const addressFailed = productAccount !== null && !addressPending && derivedAddress === null;

  return (
    <ReviewRequestLayout
      identifier={(productAccount ?? legacyAccount)?.dotNsIdentifier ?? null}
      title={call ? t('feature.browser.signingRequestTitle', { call }) : t('feature.browser.signTransaction')}
      primaryLabel={t('feature.browser.continueToSign')}
      primaryTestId={TEST_IDS.signReviewContinueButton}
      summary={
        <>
          <RequestSummaryRow label={t('feature.browser.account')} value={signer} testId={TEST_IDS.signReviewAccount} />
          <RequestSummaryRow
            label={t('feature.browser.network')}
            value={chainName ?? source.genesisHash}
            testId={TEST_IDS.signReviewNetwork}
          />
        </>
      }
      details={
        <>
          <RequestAccountDetailsSection label={t('feature.browser.account')} address={address} failed={addressFailed} />
          {decoded ? (
            <RequestDetailSection
              label={t('common.label.arguments')}
              copyValue={productRuntimeService.stringifyCallArguments(decoded.args)}
              copyLabel={t('feature.browser.copyArguments')}
              testId={TEST_IDS.signReviewArguments}
            >
              <TxArgumentsJson value={decoded.args} />
            </RequestDetailSection>
          ) : null}
          <RequestDetailSection
            label={t('common.label.callData')}
            copyValue={source.callData}
            copyLabel={t('feature.browser.copyCallData')}
            testId={TEST_IDS.signReviewCallData}
          >
            <RequestMonoLine>{source.callData}</RequestMonoLine>
          </RequestDetailSection>
        </>
      }
      hint={<RequestHint>{t('feature.browser.polkadotAppHint')}</RequestHint>}
      onApprove={() => onDecide(true)}
      onDeny={() => onDecide(false)}
    />
  );
};
