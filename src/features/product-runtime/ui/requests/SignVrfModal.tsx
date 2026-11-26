import { type SignVrfReview } from '@parity/truapi-host';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { productRuntimeService } from '../../service';
import { ProductRequestDialog } from '../ProductRequestDialog';
import {
  RequestFooter,
  RequestProductHeader,
  RequestSummaryCard,
  RequestTranscriptBlock,
  RequestTranscriptRow,
  RequestWarningBanner,
} from '../productRequestParts';

type Props = {
  review: SignVrfReview;
  onDecide: (approved: boolean) => void;
};

/**
 * RFC-0023 VRF transcript signing.
 *
 * The transcript is listed item by item rather than dumped, because a VRF signature is
 * only meaningful against the exact ordered items that went into it: seeing them in
 * order is the review. Its own layout, not `ReviewRequestLayout`, because there is no
 * summary/details split to make — the transcript IS the summary.
 */
export const SignVrfModal = ({ review, onDecide }: Props) => {
  const { t } = useTranslation();
  const { account, transcriptLabel, items } = review.request;

  return (
    <ProductRequestDialog.Root onDismiss={() => onDecide(false)}>
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-6" data-testid={TEST_IDS.signVrfDialog}>
        <RequestProductHeader identifier={review.callingProductId} />

        <div className="pt-2">
          <ProductRequestDialog.Title>
            {t('widget.productContainerBinding.signVrf.title', { requestingIdentifier: review.callingProductId })}
          </ProductRequestDialog.Title>
          <p className="mt-2 text-base text-fg-primary">{t('widget.productContainerBinding.signVrf.subtitle')}</p>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto">
          <RequestSummaryCard>
            <div className="flex items-start justify-between gap-3">
              <span className="text-base text-fg-secondary">{t('widget.productContainerBinding.signVrf.account')}</span>
              <span className="max-w-[65%] truncate font-mono text-base text-fg-primary">
                {productRuntimeService.formatProductAccount(account)}
              </span>
            </div>

            <div className="border-t border-stroke-primary" role="separator" />

            <span className="text-base text-fg-secondary">{t('widget.productContainerBinding.signVrf.transcript')}</span>
            <RequestTranscriptBlock>
              <RequestTranscriptRow
                label={t('widget.productContainerBinding.signVrf.transcriptLabel')}
                value={productRuntimeService.formatTranscriptBytes(transcriptLabel)}
              />
              {items.map(item => (
                <RequestTranscriptRow
                  key={`${item.label}-${item.value}`}
                  label={productRuntimeService.formatTranscriptBytes(item.label)}
                  value={productRuntimeService.formatTranscriptBytes(item.value)}
                />
              ))}
            </RequestTranscriptBlock>
          </RequestSummaryCard>

          <RequestWarningBanner>{t('widget.productContainerBinding.signVrf.warning')}</RequestWarningBanner>
        </div>

        <RequestFooter
          cancelLabel={t('widget.productContainerBinding.signVrf.deny')}
          primaryLabel={t('widget.productContainerBinding.signVrf.allow')}
          primaryTestId={TEST_IDS.signVrfAllow}
          onCancel={() => onDecide(false)}
          onPrimary={() => onDecide(true)}
        />
      </div>
    </ProductRequestDialog.Root>
  );
};
