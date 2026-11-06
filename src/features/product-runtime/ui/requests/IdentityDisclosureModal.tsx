import { type IdentityDisclosureReview } from '@parity/truapi-host';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';

import { PermissionRequestModal } from './PermissionRequestModal';

type Props = {
  review: IdentityDisclosureReview;
  onDecide: (approved: boolean) => void;
  onDismiss?: VoidFunction;
};

/**
 * The core's review before a product learns the user's primary username (`account.get_user_id`).
 * `review.productId` is the requesting product.
 */
export const IdentityDisclosureModal = ({ review, onDecide, onDismiss }: Props) => {
  const { t } = useTranslation();

  return (
    <PermissionRequestModal
      identifier={review.productId}
      title={t('feature.productRuntime.review.identityDisclosure.title')}
      subtitle={t('feature.productRuntime.review.identityDisclosure.subtitle')}
      warning={t('feature.productRuntime.review.identityDisclosure.warning')}
      denyLabel={t('feature.productRuntime.review.deny')}
      allowLabel={t('common.action.allow')}
      dialogTestId={TEST_IDS.identityDisclosureDialog}
      allowTestId={TEST_IDS.identityDisclosureAllow}
      onAllow={() => onDecide(true)}
      onDeny={() => onDecide(false)}
      onDismiss={onDismiss}
    />
  );
};
