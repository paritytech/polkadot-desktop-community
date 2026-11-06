import { type AccountAccessReview } from '@parity/truapi-host';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';

import { PermissionRequestModal } from './PermissionRequestModal';

type Props = {
  review: AccountAccessReview;
  onDecide: (approved: boolean) => void;
  onDismiss?: VoidFunction;
};

/**
 * One product asking to act with another product's account.
 *
 * New with the core — the host-container binding had no counterpart — so the copy is
 * new rather than restored. It names both products, because which account is being
 * borrowed is the whole decision.
 */
export const AccountAccessModal = ({ review, onDecide, onDismiss }: Props) => {
  const { t } = useTranslation();

  return (
    <PermissionRequestModal
      identifier={review.requestingProductId}
      title={t('feature.productRuntime.review.accountAccess.title', { targetIdentifier: review.targetProductId })}
      subtitle={t('feature.productRuntime.review.accountAccess.subtitle')}
      warning={t('feature.productRuntime.review.accountAccess.warning')}
      denyLabel={t('feature.productRuntime.review.deny')}
      allowLabel={t('common.action.allow')}
      dialogTestId={TEST_IDS.accountAccessDialog}
      allowTestId={TEST_IDS.accountAccessAllow}
      onAllow={() => onDecide(true)}
      onDeny={() => onDecide(false)}
      onDismiss={onDismiss}
    />
  );
};
