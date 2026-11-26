import { type ResourceAllocationReview } from '@parity/truapi-host';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { productRuntimeService } from '../../service';
import { ProductRequestDialog } from '../ProductRequestDialog';
import { RequestFooter, RequestHint, RequestProductHeader, RequestSummaryCard } from '../productRequestParts';

type Props = {
  review: ResourceAllocationReview;
  onDecide: (approved: boolean) => void;
};

/**
 * The allowance request: standing permission for a product to spend the user's
 * resources without asking again.
 *
 * Every grant is listed in its own words rather than by tag, because the differences
 * between them are not self-evident from a name and this is the one review that hands
 * out something lasting. `AutoSigning` in particular is not another storage slot.
 */
export const AllocationRequestModal = ({ review, onDecide }: Props) => {
  const { t } = useTranslation();
  const grants = productRuntimeService.describeResources(review.resources);
  const productName = review.callingProductId;

  return (
    <ProductRequestDialog.Root onDismiss={() => onDecide(false)}>
      <div className="contents" data-testid={TEST_IDS.allocationRequestDialog} />
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-6">
        <RequestProductHeader identifier={review.callingProductId} />

        <div className="pt-2">
          <ProductRequestDialog.Title>{t('widget.productContainerBinding.allocationRequest.title')}</ProductRequestDialog.Title>
          <p className="mt-2 text-base text-fg-primary">
            {t('widget.productContainerBinding.allocationRequest.description', { productName })}
          </p>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <RequestSummaryCard>
            <p className="text-base text-fg-secondary">
              {t('widget.productContainerBinding.allocationRequest.requestedResources')}
            </p>
            <ul className="flex flex-col gap-2 ps-6 text-base text-fg-primary [&>li]:list-disc">
              {grants.map(grant => (
                <li key={grant.key}>{t(grant.key, grant.values)}</li>
              ))}
            </ul>
          </RequestSummaryCard>
          {/*
            The old modal listed the SS58 address of every account a SmartContractAllowance
            would sign for. The host cannot derive one until the core persists the product
            subtree key, so the grant is named without its accounts rather than with guesses.
            TODO(truapi): restore the per-account detail pane once the core persists the
            product subtree key — see docs/_plans/truapi-upstream-issues.md.
          */}
          <div className="mt-auto flex w-full shrink-0 justify-center pt-4">
            <RequestHint>{t('widget.productContainerBinding.allocationRequest.polkadotAppHint')}</RequestHint>
          </div>
        </div>

        <RequestFooter
          cancelLabel={t('common.action.cancel')}
          primaryLabel={t('widget.productContainerBinding.allocationRequest.grantAccess')}
          onCancel={() => onDecide(false)}
          onPrimary={() => onDecide(true)}
        />
      </div>
    </ProductRequestDialog.Root>
  );
};
