import { type SignRawReview } from '@parity/truapi-host';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { useProductAccountAddress } from '@/aggregates/truapi-runtime';
import { productRuntimeService } from '../../service';
import {
  RequestAccountDetailsSection,
  RequestDetailSection,
  RequestHint,
  RequestMonoLine,
  RequestSummaryNote,
  RequestSummaryRow,
} from '../productRequestParts';

import { ReviewRequestLayout } from './ReviewRequestLayout';

type Props = {
  review: SignRawReview;
  onDecide: (approved: boolean) => void;
};

/**
 * A raw message the product wants signed.
 *
 * It opens with a note that the bytes are not readable, because the honest thing to say
 * about a raw payload is that neither the host nor the user can tell what it means. The
 * details pane shows the exact message so it can at least be inspected and copied.
 */
export const SignRawModal = ({ review, onDecide }: Props) => {
  const { t } = useTranslation();
  const message = productRuntimeService.rawPayloadText(review.value.request.payload);
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
      title={t('feature.browser.signMessageRequestTitle')}
      primaryLabel={t('feature.browser.continueToSign')}
      primaryTestId={TEST_IDS.signReviewContinueButton}
      summary={
        <>
          {/* The core stamps a watermark so a signature cannot be replayed as a
              transaction. Without one the bytes may BE a transaction, which the
              user cannot tell by reading them — so the host has to say it. */}
          {!review.value.watermarked && (
            <RequestSummaryNote tone="warning">{t('feature.browser.unwatermarkedSigningWarning')}</RequestSummaryNote>
          )}
          <RequestSummaryNote tone="info">{t('feature.browser.rawMessageNotReadableCaption')}</RequestSummaryNote>
          <RequestSummaryRow label={t('feature.browser.account')} value={signer} testId={TEST_IDS.signReviewAccount} />
        </>
      }
      details={
        <>
          <RequestAccountDetailsSection label={t('feature.browser.account')} address={address} failed={addressFailed} />
          <RequestDetailSection
            label={t('common.label.message')}
            copyValue={message}
            copyLabel={t('feature.browser.copyMessage')}
          >
            <RequestMonoLine>{message}</RequestMonoLine>
          </RequestDetailSection>
        </>
      }
      hint={<RequestHint>{t('feature.browser.polkadotAppRawMessageHint')}</RequestHint>}
      onApprove={() => onDecide(true)}
      onDeny={() => onDecide(false)}
    />
  );
};
