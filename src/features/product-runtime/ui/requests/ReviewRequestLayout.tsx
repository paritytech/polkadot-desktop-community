import { Button } from '@novasamatech/tr-ui';
import { type ReactNode, useState } from 'react';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { ProductRequestDialog } from '../ProductRequestDialog';
import { RequestBackButton, RequestFooter, RequestProductHeader, RequestSummaryCard } from '../productRequestParts';

type Props = {
  identifier: Nullable<string>;
  title: ReactNode;
  /** The card under the title: notes and labelled rows. */
  summary: ReactNode;
  /** The second pane: copyable blocks, reached through "More details". */
  details?: ReactNode;
  /** The line above the footer telling the user where the signature comes from. */
  hint?: ReactNode;
  primaryLabel: string;
  primaryTestId?: string;
  onApprove: VoidFunction;
  onDeny: VoidFunction;
};

/**
 * The two-pane review layout: a summary card that answers "what am I approving", and a
 * details pane behind "More details" for the bytes.
 *
 * One layout for every request that carries a payload — transactions, payloads, raw
 * messages, VRF transcripts, statements. The panes are swapped inside a single dialog
 * rather than opened as a second one, which is the whole reason `ProductRequestDialog`
 * owns the `Dialog`: a details view that mounted its own would flash the overlay.
 *
 * The details pane replaces the title with a back chevron in the same corner, so the
 * heading never competes with the control that leaves the pane.
 */
export const ReviewRequestLayout = ({
  identifier,
  title,
  summary,
  details,
  hint,
  primaryLabel,
  primaryTestId,
  onApprove,
  onDeny,
}: Props) => {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);

  const toggleDetails = () => setShowDetails(value => !value);

  return (
    <ProductRequestDialog.Root onDismiss={onDeny}>
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-6">
        {showDetails ? (
          <RequestBackButton onClick={toggleDetails} />
        ) : (
          <>
            {/* TODO(truapi): render the header unconditionally when UserConfirmation reviews carry a ProductContext —
                until then an Identity legacy review and the reviews without a ProductContext name no product. */}
            {identifier ? <RequestProductHeader identifier={identifier} /> : null}
            <div className="pt-2">
              <ProductRequestDialog.Title>
                <span data-testid={TEST_IDS.signReviewCallTitle}>{title}</span>
              </ProductRequestDialog.Title>
            </div>
          </>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {showDetails ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-8 overflow-y-auto pe-1 pt-14">{details}</div>
          ) : (
            <>
              <RequestSummaryCard>
                {summary}
                {details ? (
                  <div className="mt-1 w-full">
                    <Button
                      type="button"
                      variant="secondary"
                      fullWidth
                      aria-expanded={showDetails}
                      data-testid={TEST_IDS.signReviewMoreDetails}
                      onClick={toggleDetails}
                    >
                      {t('common.action.moreDetails')}
                    </Button>
                  </div>
                ) : null}
              </RequestSummaryCard>
              {hint ? <div className="mt-auto flex w-full shrink-0 justify-center pt-4">{hint}</div> : null}
            </>
          )}
        </div>

        {showDetails ? null : (
          <RequestFooter
            cancelLabel={t('common.action.cancel')}
            primaryLabel={primaryLabel}
            primaryTestId={primaryTestId}
            onCancel={onDeny}
            onPrimary={onApprove}
          />
        )}
      </div>
    </ProductRequestDialog.Root>
  );
};
